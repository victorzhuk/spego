-- Host half of the Spego Tern plugin: a read-only delivery board block.

local STREAM_CAP = 16 * 1024 * 1024

type State = {
	pane: number,
	cx: any,
	root: string?,
	rootError: string?,
	board: any?,
	loadError: string?,
	stale: boolean,
	loading: boolean,
	boardGen: number,
	boardPending: boolean,
	taskGen: number,
	tasks: { any }?,
	taskError: string?,
	taskChangeId: string?,
	selectedChangeId: string?,
	selectedSection: string?,
	detailsOpen: boolean,
	showArchived: boolean,
	showClosed: boolean,
}

local panes: { [number]: State } = {}

local function isAbsolute(path: any): boolean
	if type(path) ~= "string" then
		return false
	end
	return path:sub(1, 1) == "/" or path:match("^%a:[/\\]") ~= nil
end

local function validSavedPreferences(saved: any): boolean
	if type(saved) ~= "table" or type(saved.version) ~= "number" or saved.version ~= 1 then
		return false
	end
	if type(saved.showArchived) ~= "boolean"
		or type(saved.showClosed) ~= "boolean"
		or type(saved.detailsOpen) ~= "boolean"
	then
		return false
	end
	if saved.root ~= nil and not isAbsolute(saved.root) then
		return false
	end
	local hasId = saved.selectedChangeId ~= nil
	local hasSection = saved.selectedSection ~= nil
	if hasId ~= hasSection then
		return false
	end
	if hasId then
		if type(saved.selectedChangeId) ~= "string" or saved.selectedChangeId == "" then
			return false
		end
		if type(saved.selectedSection) ~= "string" or saved.selectedSection == "" then
			return false
		end
		if saved.selectedSection ~= "ungrouped" then
			local suffix = saved.selectedSection:match("^sprint:(.+)$")
			if suffix == nil or suffix == "" then
				return false
			end
		end
	end
	if saved.detailsOpen == true and not hasId then
		return false
	end
	return true
end

local function keyed(node: any, id: string): any
	if node.p == nil then
		node.p = {}
	end
	node.p.key = id
	return node
end

local function displayStatus(status: any): string
	if status == "completed" then
		return "archived"
	end
	return tostring(status)
end

-- Legend order follows src/cli/commands/board.ts; blocked renders as paused.
local STATUS_LEGEND_ORDER = { "backlog", "in-progress", "done", "completed", "paused", "unknown" }
local STATUS_ICONS = {
	backlog = "○",
	["in-progress"] = "▶",
	done = "✓",
	completed = "▣",
	paused = "Ⅱ",
	unknown = "?",
}
local STATUS_LABELS = {
	backlog = "backlog",
	["in-progress"] = "in-progress",
	done = "done",
	completed = "archived",
	paused = "paused",
	unknown = "unknown",
}

local function statusDisplayKey(status: any): string
	return status == "blocked" and "paused" or status
end

local PLAN_ICONS = { planned = "✓" }

local function isSatisfied(status: any): boolean
	return status == "done" or status == "completed"
end

local function statusSpan(ch: any): any
	local key = statusDisplayKey(ch.status)
	if STATUS_ICONS[key] == nil then
		key = "unknown"
	end
	return tern.ui.span(STATUS_ICONS[key])
end

local function planSpan(ch: any): any
	if isSatisfied(ch.status) then
		return tern.ui.span("—")
	end
	local st = ch.planState
	if st == "planned" then
		return tern.ui.span(PLAN_ICONS[st])
	end
	return tern.ui.span("—")
end

local function formatHours(hours: number): string
	return string.format("%g", math.floor(hours * 100 + 0.5) / 100)
end

local function tasksSpan(ch: any): any
	if type(ch.taskCount) == "number" and type(ch.tasksDone) == "number" then
		return tern.ui.span(string.format("%d/%d", ch.tasksDone, ch.taskCount), "num")
	end
	return tern.ui.span("—", "muted")
end

local function hoursSpan(ch: any): any
	if type(ch.flowEstimate) ~= "number" then
		return tern.ui.span("?", "muted")
	end
	local mark = ch.rung == "planned" and "†" or (ch.rung == "observed" and "*" or "")
	return tern.ui.span(formatHours(ch.flowEstimate) .. mark, "num")
end

local function signalsSpan(ch: any): any
	local parts: { string } = {}
	if type(ch.blockers) == "table" and #ch.blockers > 0 then
		table.insert(parts, #ch.blockers .. " blk")
	end
	if type(ch.gaps) == "table" and #ch.gaps > 0 then
		table.insert(parts, #ch.gaps .. " gap")
	end
	if type(ch.missing) == "table" and #ch.missing > 0 then
		table.insert(parts, #ch.missing .. " mis")
	end
	if #parts == 0 then
		return tern.ui.span("—", "muted")
	end
	return tern.ui.span(table.concat(parts, " · "), nil)
end

local function warningText(w: any): string
	if type(w) == "string" then
		return w
	end
	local code = tostring(w.code or w.flag or "warning")
	local msg = w.message or w.note or w.reason
	if msg then
		return code .. ": " .. tostring(msg)
	end
	return code
end

local function isAdapterUnavailable(board: any): boolean
	for _, w in board.warnings or {} do
		if type(w) == "table" and w.code == "adapter-unavailable" then
			return true
		end
		if w == "adapter-unavailable" then
			return true
		end
	end
	return false
end

local function sprintFinished(sprint: any): boolean
	if not (sprint.complete == true or sprint.status == "closed") then
		return false
	end
	local changes = sprint.changes or {}
	if #changes == 0 then
		return false
	end
	for _, ch in changes do
		if ch.status ~= "done" and ch.status ~= "completed" then
			return false
		end
	end
	return true
end

local function paneLive(pane: number): boolean
	for _, info in tern.pane.list() do
		if info.pane == pane then
			return true
		end
	end
	return false
end

-- Every place a change id appears, in payload order: {ch, section} rows.
local function occurrencesOf(board: any, id: string?): { any }
	local found: { any } = {}
	if board == nil or type(id) ~= "string" then
		return found
	end
	for _, sprint in board.sprints do
		for _, ch in sprint.changes or {} do
			if ch.id == id then
				table.insert(found, { ch = ch, section = "sprint:" .. tostring(sprint.slug) })
			end
		end
	end
	for _, ch in board.ungrouped do
		if ch.id == id then
			table.insert(found, { ch = ch, section = "ungrouped" })
		end
	end
	return found
end

-- Keep the selection on the same change id across a refresh, preferring the
-- previously selected section, otherwise the first occurrence in payload order.
local function resolveSelection(st: State)
	if st.board == nil or st.selectedChangeId == nil then
		st.selectedChangeId = nil
		st.selectedSection = nil
		return
	end
	local found = occurrencesOf(st.board, st.selectedChangeId)
	if #found == 0 then
		st.selectedChangeId = nil
		st.selectedSection = nil
		st.detailsOpen = false
		return
	end
	local pick = found[1]
	for _, occ in found do
		if occ.section == st.selectedSection then
			pick = occ
			break
		end
	end
	st.selectedSection = pick.section
end

local function selectedChange(st: State): any?
	local found = occurrencesOf(st.board, st.selectedChangeId)
	for _, occ in found do
		if occ.section == st.selectedSection then
			return occ.ch
		end
	end
	return found[1] and found[1].ch or nil
end

-- Task summaries load only for an active, non-archived change with a known
-- readable, non-empty plan.
local function taskEligible(ch: any): boolean
	if type(ch) ~= "table" or ch.archived == true then
		return false
	end
	if ch.status == "done" or ch.status == "completed" then
		return false
	end
	if type(ch.taskCount) ~= "number" or ch.taskCount <= 0 then
		return false
	end
	if type(ch.slug) ~= "string" or ch.slug == "" then
		return false
	end
	return true
end

-- Hours column exists only when the payload carries estimates; low priorities
-- hide signals, then hours, on narrow panes.
local function boardTable(changes: { any }, section: string, priced: boolean): any
	local cols: { any } = {
		{ id = "id", head = "id" },
		{ id = "change", head = "change", grow = 1 },
		{ id = "signals", head = "signals", priority = -2 },
		{ id = "status", head = "status", align = "center" },
		{ id = "tasks", head = "tasks", align = "end" },
		{ id = "plan", head = "plan", align = "center" },
	}
	if priced then
		table.insert(cols, { id = "hours", head = "hours", align = "end", priority = -1 })
	end
	local rows: { any } = {}
	for _, ch in changes do
		local cells: { any } = {
			tern.ui.span(tostring(ch.id or "?"), "muted"),
			tern.ui.span(tostring(ch.slug or "?"), nil),
			signalsSpan(ch),
			statusSpan(ch),
			tasksSpan(ch),
			planSpan(ch),
		}
		if priced then
			table.insert(cells, hoursSpan(ch))
		end
		table.insert(rows, cells)
	end
	return tern.ui.table(cols, rows)
end

-- Legend names every status the rendered rows use, in the CLI's order, then
-- the plan states in use on unsatisfied rows. nil when there is nothing.
local function legendNode(changes: { any }): any?
	local statuses: { [string]: boolean } = {}
	local plans: { [string]: boolean } = {}
	for _, ch in changes do
		local key = STATUS_LABELS[statusDisplayKey(ch.status)] and statusDisplayKey(ch.status) or "unknown"
		statuses[key] = true
		if not isSatisfied(ch.status) and ch.planState == "planned" then
			plans[ch.planState] = true
		end
	end
	local spans: { any } = {}
	for _, status in STATUS_LEGEND_ORDER do
		if statuses[status] then
			table.insert(spans, tern.ui.span(STATUS_ICONS[status] .. " " .. STATUS_LABELS[status]))
			table.insert(spans, "  ")
		end
	end
	for _, plan in { "planned" } do
		if plans[plan] then
			table.insert(spans, tern.ui.span(PLAN_ICONS[plan] .. " " .. plan))
			table.insert(spans, "  ")
		end
	end
	if #spans == 0 then
		return nil
	end
	spans[#spans] = nil
	return tern.ui.text(spans)
end

-- Compact toolbar control: native icon, accessible name and tooltip, and
-- an optional pressed state carried through aria-pressed and icon tone.
local function toolbarButton(id: string, iconName: string, label: string, pressed: boolean?): any
	local props: { [string]: any } = {
		id = id,
		role = "spego.toolbar-button",
		title = label,
		aria = label,
		actions = { click = id },
	}
	if pressed ~= nil then
		props.attrs = { ["aria-pressed"] = pressed }
	end
	local icon = tern.ui.node("icon", {
		name = iconName,
		tone = pressed == true and "accent" or "neutral",
	})
	return keyed(tern.ui.el("button", props, { keyed(icon, id .. "-icon") }), id)
end

-- Sprint head: title strong, then status, dates and the sprint-scope signals
-- the CLI's sprintTitle carries.
local function sectionHeadSpans(sprint: any): { any }
	local spans: { any } = { tern.ui.span(tostring(sprint.title or sprint.slug or "?"), "strong") }
	local function add(text: string)
		table.insert(spans, tern.ui.span(" · " .. text, "muted"))
	end
	add(displayStatus(sprint.status))
	if type(sprint.startDate) == "string" and type(sprint.endDate) == "string" then
		add(sprint.startDate .. " → " .. sprint.endDate)
	end
	if type(sprint.flowTotal) == "number" then
		local unpriced = (sprint.unpricedPending or 0) > 0 and "+?" or ""
		add(formatHours(sprint.flowTotal) .. unpriced .. "h")
	end
	if type(sprint.missing) == "table" and #sprint.missing > 0 then
		add(#sprint.missing .. " mis")
	end
	return spans
end

local function sectionHead(title: string, detail: string?): any
	local spans: { any } = { tern.ui.span(title, "strong") }
	if detail then
		table.insert(spans, tern.ui.span("  " .. detail, "muted"))
	end
	return spans
end

local function isDenseArray(v: any): boolean
	if type(v) ~= "table" then
		return false
	end
	local count = 0
	local max = 0
	for k, _ in v do
		if type(k) ~= "number" or k ~= math.floor(k) or k < 1 then
			return false
		end
		if k > max then
			max = k
		end
		count += 1
	end
	if count ~= max then
		return false
	end
	for i = 1, max do
		if v[i] == tern.json.null then
			return false
		end
	end
	return true
end

local function isFiniteNumber(v: any): boolean
	return type(v) == "number" and v == v and v ~= math.huge and v ~= -math.huge
end

local function isNonNegInt(v: any): boolean
	return isFiniteNumber(v) and v >= 0 and v == math.floor(v)
end

local function isStringArray(v: any): boolean
	if not isDenseArray(v) then
		return false
	end
	for _, item in v do
		if type(item) ~= "string" then
			return false
		end
	end
	return true
end

local function validateGap(gap: any, path: string): string?
	if type(gap) ~= "table" then
		return path .. " must be an object"
	end
	if type(gap.flag) ~= "string" then
		return path .. ".flag must be a string"
	end
	if gap.note ~= nil and type(gap.note) ~= "string" then
		return path .. ".note must be a string"
	end
	return nil
end

local function validateChange(ch: any, path: string): string?
	if type(ch) ~= "table" then
		return path .. " must be an object"
	end
	for _, f in { "id", "slug", "title", "status", "group" } do
		if type(ch[f]) ~= "string" then
			return path .. "." .. f .. " must be a string"
		end
	end
	if ch.id == "" then
		return path .. ".id must be a nonempty string"
	end
	if ch.slug == "" then
		return path .. ".slug must be a nonempty string"
	end
	if type(ch.archived) ~= "boolean" then
		return path .. ".archived must be a boolean"
	end
	for _, f in { "blockers", "missing", "warnings" } do
		if not isStringArray(ch[f]) then
			return path .. "." .. f .. " must be an array of strings"
		end
	end
	if not isDenseArray(ch.gaps) then
		return path .. ".gaps must be an array"
	end
	for i, gap in ch.gaps do
		local err = validateGap(gap, path .. ".gaps[" .. i .. "]")
		if err ~= nil then
			return err
		end
	end
	if ch.taskCount == nil and ch.tasksDone ~= nil then
		return path .. ".taskCount must be a nonnegative integer"
	end
	if ch.tasksDone == nil and ch.taskCount ~= nil then
		return path .. ".tasksDone must be a nonnegative integer"
	end
	if ch.taskCount ~= nil then
		if not isNonNegInt(ch.taskCount) then
			return path .. ".taskCount must be a nonnegative integer"
		end
		if not isNonNegInt(ch.tasksDone) then
			return path .. ".tasksDone must be a nonnegative integer"
		end
		if ch.tasksDone > ch.taskCount then
			return "tasksDone must not exceed taskCount"
		end
	end
	for _, f in { "flowEstimate", "humanEstimate", "flowTotal", "actualsTotal" } do
		if ch[f] ~= nil and not isFiniteNumber(ch[f]) then
			return path .. "." .. f .. " must be a finite number"
		end
	end
	if ch.rung ~= nil and type(ch.rung) ~= "string" then
		return path .. ".rung must be a string"
	end
	if ch.planState ~= nil and ch.planState ~= "planned" and ch.planState ~= "none" then
		return path .. ".planState must be planned or none"
	end
	return nil
end

local function validateSprint(sprint: any, path: string): string?
	if type(sprint) ~= "table" then
		return "sprint row is not an object"
	end
	for _, f in { "slug", "title", "status" } do
		if type(sprint[f]) ~= "string" then
			return path .. "." .. f .. " must be a string"
		end
	end
	if sprint.slug == "" then
		return path .. ".slug must be a nonempty string"
	end
	if type(sprint.complete) ~= "boolean" then
		return path .. ".complete must be a boolean"
	end
	if not isDenseArray(sprint.changes) then
		return path .. ".changes must be an array"
	end
	if not isStringArray(sprint.missing) then
		return path .. ".missing must be an array of strings"
	end
	for _, f in { "startDate", "endDate" } do
		if sprint[f] ~= nil and type(sprint[f]) ~= "string" then
			return path .. "." .. f .. " must be a string"
		end
	end
	if sprint.flowTotal ~= nil and not isFiniteNumber(sprint.flowTotal) then
		return path .. ".flowTotal must be a finite number"
	end
	if sprint.unpricedPending ~= nil and not isNonNegInt(sprint.unpricedPending) then
		return path .. ".unpricedPending must be a nonnegative integer"
	end
	for i, ch in sprint.changes do
		if type(ch) ~= "table" or type(ch.id) ~= "string" then
			return "sprint change row is malformed"
		end
		local err = validateChange(ch, path .. ".changes[" .. i .. "]")
		if err ~= nil then
			return err
		end
	end
	return nil
end

local function validateBoard(v: any): string?
	if type(v) ~= "table" then
		return "board payload is not an object"
	end
	if not isDenseArray(v.sprints) then
		return "board payload has no sprints array"
	end
	if not isDenseArray(v.ungrouped) then
		return "board payload has no ungrouped array"
	end
	if not isDenseArray(v.warnings) then
		return "board payload has no warnings array"
	end
	for i, sprint in v.sprints do
		local err = validateSprint(sprint, "sprints[" .. i .. "]")
		if err ~= nil then
			return err
		end
	end
	for i, ch in v.ungrouped do
		if type(ch) ~= "table" or type(ch.id) ~= "string" then
			return "ungrouped change row is malformed"
		end
		local err = validateChange(ch, "ungrouped[" .. i .. "]")
		if err ~= nil then
			return err
		end
	end
	for i, w in v.warnings do
		if type(w) ~= "table" then
			return "warnings[" .. i .. "] must be an object"
		end
		if type(w.code) ~= "string" then
			return "warnings[" .. i .. "].code must be a string"
		end
		if type(w.message) ~= "string" then
			return "warnings[" .. i .. "].message must be a string"
		end
	end
	if v.next ~= nil then
		if type(v.next) ~= "table" then
			return "next must be an object"
		end
		for _, f in { "change", "sprint", "reason" } do
			if type(v.next[f]) ~= "string" then
				return "next." .. f .. " must be a string"
			end
		end
	end
	return nil
end

local function validateTasks(v: any): string?
	if not isDenseArray(v) then
		return "spego tasks payload is not an array"
	end
	for i, task in v do
		local path = "tasks[" .. i .. "]"
		if type(task) ~= "table" then
			return path .. " must be an object"
		end
		for _, f in { "externalId", "title", "status" } do
			if type(task[f]) ~= "string" then
				return path .. "." .. f .. " must be a string"
			end
		end
		if task.status ~= "done" and task.status ~= "pending" and task.status ~= "unknown" then
			return path .. ".status must be done, pending, or unknown"
		end
	end
	return nil
end

local startTasks: (State) -> ()
local function startLoad(st: State)
	if st.root == nil or st.loading then
		return
	end
	st.loading = true
	st.boardGen += 1
	local gen = st.boardGen
	local pane = st.pane
	local root = st.root
	local argv = { "spego", "--json", "board", "--fresh" }
	if st.showArchived then
		table.insert(argv, "--archived")
	end
	table.insert(argv, "--cwd")
	table.insert(argv, root)
	local ok = pcall(tern.process.run, argv, { cwd = root, timeout_ms = 10000 }, function(result)
		local cur = panes[pane]
		if cur == nil or cur ~= st or cur.boardGen ~= gen or cur.root ~= root or not paneLive(pane) then
			return
		end
		local err: string?
		if result.timed_out then
			err = "spego board timed out after 10s"
		elseif result.status ~= 0 then
			local detail = result.stderr:gsub("^%s+", ""):gsub("%s+$", "")
			if detail == "" then
				err = string.format("spego board exited with status %d", result.status)
			else
				err = detail
			end
		elseif #result.stdout >= STREAM_CAP or #result.stderr >= STREAM_CAP then
			err = "spego board output reached the 16 MiB stream cap"
		else
			local decodeOk: boolean
			local decoded: any
			decodeOk, decoded, err = pcall(tern.json.decode, result.stdout)
			if not decodeOk then
				err = "spego board printed malformed JSON: " .. tostring(decoded)
				decoded = nil
			elseif err ~= nil then
				err = "spego board printed malformed JSON: " .. tostring(err)
				decoded = nil
			else
				err = validateBoard(decoded)
				if err == nil then
					cur.taskGen += 1
					cur.tasks = nil
					cur.taskError = nil
					cur.taskChangeId = nil
					cur.board = decoded
					cur.loadError = nil
					cur.stale = false
				end
			end
		end
		if err ~= nil then
			if cur.board ~= nil then
				cur.stale = true
				cur.loadError = err
			else
				cur.board = nil
				cur.stale = false
				cur.loadError = err
			end
		end
		cur.loading = false
		cur.boardGen += 1
		local pending = cur.boardPending
		cur.boardPending = false
		if err == nil then
			resolveSelection(cur)
			if cur.detailsOpen then
				startTasks(cur)
			end
		end
		pcall(function()
			cur.cx:render()
		end)
		if pending and cur.root ~= nil then
			startLoad(cur)
		end
	end)
	if not ok then
		st.loading = false
		st.boardGen += 1
		if st.board ~= nil then
			st.stale = true
		else
			st.board = nil
		end
		st.loadError = "could not start spego (is it on the daemon's PATH?)"
	end
end

startTasks = function(st: State)
	local ch = selectedChange(st)
	if not st.detailsOpen or st.board == nil or ch == nil then
		return
	end
	st.taskGen += 1
	st.tasks = nil
	st.taskError = nil
	st.taskChangeId = nil
	if type(ch.taskCount) ~= "number" then
		return
	end
	if ch.taskCount == 0 then
		-- Known-empty plan: empty task list without a process.
		st.tasks = {}
		st.taskChangeId = ch.id
		return
	end
	if not taskEligible(ch) then
		return
	end
	st.taskChangeId = ch.id
	local slug = ch.slug
	local gen = st.taskGen
	local pane = st.pane
	local root = st.root :: string
	local changeId = ch.id :: string
	local argv = { "spego", "--json", "tasks", slug, "--cwd", root }
	local ok = pcall(tern.process.run, argv, { cwd = root, timeout_ms = 10000 }, function(result)
		local cur = panes[pane]
		if cur == nil or cur ~= st or cur.taskGen ~= gen or cur.root ~= root or not paneLive(pane) then
			return
		end
		if cur.selectedChangeId ~= changeId then
			return
		end
		local err: string?
		local decoded: any
		if result.timed_out then
			err = "spego tasks timed out after 10s"
		elseif result.status ~= 0 then
			local detail = result.stderr:gsub("^%s+", ""):gsub("%s+$", "")
			err = detail ~= "" and detail
				or string.format("spego tasks exited with status %d", result.status)
		elseif #result.stdout >= STREAM_CAP or #result.stderr >= STREAM_CAP then
			err = "spego tasks output reached the 16 MiB stream cap"
		else
			local decodeOk
			decodeOk, decoded = pcall(tern.json.decode, result.stdout)
			if not decodeOk then
				err = "spego tasks printed malformed JSON: " .. tostring(decoded)
				decoded = nil
			elseif type(decoded) ~= "table" then
				err = "spego tasks payload is not an array"
				decoded = nil
			else
				local diag = validateTasks(decoded)
				if diag ~= nil then
					err = diag
					decoded = nil
				end
			end
		end
		if err == nil then
			cur.tasks = decoded
			cur.taskError = nil
		else
			cur.tasks = nil
			cur.taskError = err
		end
		pcall(function()
			cur.cx:render()
		end)
	end)
	if not ok then
		st.tasks = nil
		st.taskError = "could not start spego tasks (is it on the daemon's PATH?)"
	end
end

type Occurrence = { ch: any, section: string }

local function visibleOccurrences(st: State): { Occurrence }
	local found: { Occurrence } = {}
	if st.board == nil then
		return found
	end
	for _, sprint in st.board.sprints do
		if not (sprintFinished(sprint) and not st.showClosed) then
			local section = "sprint:" .. tostring(sprint.slug)
			for _, ch in sprint.changes or {} do
				table.insert(found, { ch = ch, section = section })
			end
		end
	end
	for _, ch in st.board.ungrouped do
		if not (ch.archived == true and not st.showArchived) then
			table.insert(found, { ch = ch, section = "ungrouped" })
		end
	end
	return found
end

local function detailsAction(occ: Occurrence): string
	return string.format("open %q %q %s", occ.section, occ.ch.id, tostring(occ.ch.slug or occ.ch.id))
end

local function selectOccurrence(st: State, section: string, id: string): boolean
	local match: Occurrence? = nil
	for _, occ in visibleOccurrences(st) do
		if occ.section == section and occ.ch.id == id then
			match = occ
			break
		end
	end
	if match == nil then
		return false
	end
	if st.detailsOpen and st.selectedChangeId == id and st.selectedSection == section then
		return true
	end
	st.selectedChangeId = id
	st.selectedSection = section
	st.detailsOpen = true
	startTasks(st)
	return true
end

local function navigateDetails(st: State, direction: number): boolean
	if not st.detailsOpen then
		return false
	end
	local occs = visibleOccurrences(st)
	if #occs == 0 then
		return true
	end
	local index: number? = nil
	for i, occ in occs do
		if occ.ch.id == st.selectedChangeId and occ.section == st.selectedSection then
			index = i
			break
		end
	end
	if index == nil then
		local occ = direction == 1 and occs[1] or occs[#occs]
		return selectOccurrence(st, occ.section, occ.ch.id)
	end
	local target = index + direction
	if target < 1 or target > #occs then
		return true
	end
	return selectOccurrence(st, occs[target].section, occs[target].ch.id)
end

local function detailRow(label: string, value: string, key: string): any
	return keyed(tern.ui.text({
		tern.ui.span(label .. ": ", "strong"),
		tern.ui.span(value, "muted"),
	}), key)
end

local function renderDetails(st: State): any?
	local ch = selectedChange(st)
	if ch == nil then
		return nil
	end
	local children: { any } = {
		keyed(tern.ui.text({
			tern.ui.span("Details: ", "strong"),
			tern.ui.span(tostring(ch.title or ch.id or "?"), nil),
		}), "d-title"),
	}
	table.insert(children, detailRow("slug", tostring(ch.slug or "-"), "d-slug"))
	table.insert(children, detailRow("status", displayStatus(ch.status), "d-status"))
	if ch.group ~= nil then
		table.insert(children, detailRow("track", tostring(ch.group), "d-track"))
	end
	if type(ch.planState) == "string" then
		table.insert(children, detailRow("plan state", ch.planState, "d-plan"))
	end
	if type(ch.taskCount) == "number" and type(ch.tasksDone) == "number" then
		table.insert(children, detailRow("progress", string.format("%d/%d tasks", ch.tasksDone, ch.taskCount), "d-progress"))
	else
		table.insert(children, keyed(tern.ui.text({ tern.ui.span("progress: unavailable", "muted") }), "d-progress"))
	end
	if type(ch.flowTotal) == "number" then
		table.insert(children, detailRow("flow actuals", string.format("%.1fh", ch.flowTotal), "d-flow"))
	end
	if type(ch.actualsTotal) == "number" then
		table.insert(children, detailRow("actuals total", string.format("%.1fh", ch.actualsTotal), "d-actuals"))
	end
	if type(ch.flowEstimate) == "number" then
		table.insert(children, detailRow("flow estimate", string.format("%.1fh", ch.flowEstimate), "d-fest"))
	end
	if type(ch.humanEstimate) == "number" then
		table.insert(children, detailRow("human estimate", string.format("%.1fh", ch.humanEstimate), "d-hest"))
	end
	if type(ch.blockers) == "table" and #ch.blockers > 0 then
		table.insert(children, detailRow("blockers", table.concat(ch.blockers, ", "), "d-blockers"))
	end
	if type(ch.missing) == "table" and #ch.missing > 0 then
		table.insert(children, detailRow("missing artifacts", table.concat(ch.missing, ", "), "d-missing"))
	end
	if type(ch.gaps) == "table" and #ch.gaps > 0 then
		local gapChildren: { any } = {}
		for i, gap in ch.gaps do
			local text = gap.flag
			if type(gap.note) == "string" and gap.note ~= "" then
				text = gap.flag .. ": " .. gap.note
			end
			table.insert(
				gapChildren,
				keyed(tern.ui.text({ tern.ui.span("- " .. text, nil) }), "d-gap" .. i)
			)
		end
		table.insert(children, keyed(tern.ui.section(sectionHead("Gaps"), gapChildren), "d-gaps"))
	end
	if type(ch.warnings) == "table" and #ch.warnings > 0 then
		local warnChildren: { any } = {}
		for i, w in ch.warnings do
			table.insert(
				warnChildren,
				keyed(tern.ui.text({ tern.ui.span("- " .. warningText(w), "muted") }), "d-warn" .. i)
			)
		end
		table.insert(children, keyed(tern.ui.section(sectionHead("Warnings"), warnChildren), "d-warnings"))
	end

	-- Task list: known-empty plan shows an empty list with no process; an
	-- eligible plan loads lazily; ineligible plans keep board-only details.
	local taskChildren: { any } = {}
	if type(ch.taskCount) == "number" then
		if st.taskChangeId == ch.id and st.taskError ~= nil then
			table.insert(taskChildren, keyed(tern.ui.text({ tern.ui.span(st.taskError, "error") }), "task-err"))
		elseif type(st.tasks) == "table" and st.taskChangeId == ch.id then
			if #st.tasks == 0 then
				table.insert(taskChildren, keyed(tern.ui.text({ tern.ui.span("no tasks", "muted") }), "task-empty"))
			else
				for i, task in st.tasks do
					local label = tostring(task.title or task.externalId or "?")
					local status = tostring(task.status or "?")
					local spans: { any }
					if status == "done" then
						spans = { tern.ui.span(label, "muted"), tern.ui.span("  " .. status, "muted") }
					else
						spans = { tern.ui.span(label, nil), tern.ui.span("  " .. status, "muted") }
					end
					-- externalId can repeat, so keys use the list occurrence.
					table.insert(taskChildren, keyed(tern.ui.text(spans), "task:" .. i))
				end
			end
		elseif not taskEligible(ch) then
			table.insert(
				taskChildren,
				keyed(
					tern.ui.text({ tern.ui.span("tasks not loaded (archived or finished change)", "muted") }),
					"task-ineligible"
				)
			)
		else
			table.insert(taskChildren, keyed(tern.ui.text({ tern.ui.span("tasks: loading…", "muted") }), "task-loading"))
		end
	else
		table.insert(
			taskChildren,
			keyed(tern.ui.text({ tern.ui.span("task plan unavailable - board details only", "muted") }), "task-none")
		)
	end
	table.insert(children, keyed(tern.ui.section(sectionHead("Tasks"), taskChildren), "d-tasks"))

	table.insert(
		children,
		keyed(tern.ui.el("button", { text = "Close details (Escape)", id = "close-details" }), "close-details")
	)
	return keyed(tern.ui.section(sectionHead("Change details"), children), "details")
end

local function renderBoard(st: State): any
	local children: { any } = {}

	-- Controls: interactive only. Table rows carry no per-row actions in
	-- Tern, so a change is selected through the Details menu listing every
	-- rendered change.
	local controls: { any } = {
		toolbarButton("refresh", "repeat", "Refresh board (r)"),
	}

	if st.board ~= nil then
		local board = st.board
		local priced = false
		local function scanPriced(changes: any)
			for _, ch in changes or {} do
				if type(ch.flowEstimate) == "number" then
					priced = true
				end
			end
		end
		for _, sprint in board.sprints do
			scanPriced(sprint.changes)
		end
		scanPriced(board.ungrouped)

		local visible: { any } = {}
		local hidden = 0
		local hiddenArchived = 0
		local anyChange = false

		table.insert(controls, toolbarButton(
			"toggle-archived",
			"box",
			st.showArchived and "Hide archived changes (a)" or "Show archived changes (a)",
			st.showArchived
		))
		table.insert(controls, toolbarButton(
			"toggle-closed",
			"list-checks",
			st.showClosed and "Hide finished sprints (c)" or "Show finished sprints (c)",
			st.showClosed
		))
		local menuEntries: { string } = {}
		for _, sprint in board.sprints do
			local finished = sprintFinished(sprint)
			if finished and not st.showClosed then
				if #(sprint.changes or {}) > 0 then
					hidden += 1
				end
				anyChange = anyChange or #(sprint.changes or {}) > 0
			else
				for _, ch in sprint.changes or {} do
					table.insert(visible, ch)
				end
			end
		end
		local ungroupedRows: { any } = {}
		local ungroupedCount = 0
		for _, ch in board.ungrouped do
			if ch.archived == true and not st.showArchived then
				hiddenArchived += 1
			else
				ungroupedCount += 1
				table.insert(visible, ch)
				table.insert(ungroupedRows, ch)
			end
		end
		for _, occ in visibleOccurrences(st) do
			table.insert(menuEntries, detailsAction(occ))
		end
		if #menuEntries > 0 then
			local button = toolbarButton("open-details", "info", "Change details (d, or right-click)")
			local p: { [string]: any } = button.p or {}
			p.actions = { menu = menuEntries }
			button.p = p
			table.insert(controls, keyed(button, "open-details"))
		end

		local legend = legendNode(visible)
		if legend ~= nil then
			table.insert(children, keyed(legend, "legend"))
		end

		for _, sprint in board.sprints do
			local finished = sprintFinished(sprint)
			if finished and not st.showClosed then
				-- counted above
			else
				local section = "sprint:" .. tostring(sprint.slug)
				local card = tern.ui.card(sectionHeadSpans(sprint), {
					boardTable(sprint.changes or {}, section, priced),
				})
				local p: { [string]: any } = card.p or {}
				p.key = section
				if finished then
					p.tone = "muted"
				end
				card.p = p
				table.insert(children, card)
			end
		end
		if ungroupedCount > 0 then
			local card = tern.ui.card(sectionHead("Ungrouped"), {
				boardTable(ungroupedRows, "ungrouped", priced),
			})
			local p: { [string]: any } = card.p or {}
			p.key = "ungrouped"
			card.p = p
			table.insert(children, card)
		end
		anyChange = anyChange or ungroupedCount > 0

		local hasSignal = false
		local sawObserved = false
		local sawPlanned = false
		for _, ch in visible do
			local signals = (type(ch.blockers) == "table" and #ch.blockers or 0)
				+ (type(ch.gaps) == "table" and #ch.gaps or 0)
				+ (type(ch.missing) == "table" and #ch.missing or 0)
			hasSignal = hasSignal or signals > 0
			sawObserved = sawObserved or ch.rung == "observed"
			sawPlanned = sawPlanned or ch.rung == "planned"
		end

		if board.warnings ~= nil and #board.warnings > 0 then
			local warnRows: { any } = {}
			for i, w in board.warnings do
				local code: string
				local message: string
				if type(w) == "table" then
					code = tostring(w.code or "warning")
					message = warningText(w)
				else
					code = "warning"
					message = warningText(w)
				end
				table.insert(warnRows, {
					tern.ui.span(code, "code"),
					tern.ui.span(message, nil),
				})
			end
			if isAdapterUnavailable(board) then
				table.insert(warnRows, {
					tern.ui.span("adapter-unavailable", "code"),
					tern.ui.span(
						"delivery adapter unavailable - mirror data may be incomplete; this is not an empty workspace",
						nil
					),
				})
			end
			local warnTable = tern.ui.table({
				{ id = "code", head = "code" },
				{ id = "message", head = "message", grow = 1 },
			}, warnRows)
			table.insert(children, keyed(tern.ui.card(sectionHead("Warnings"), { warnTable }), "warnings"))
		end

		if not anyChange and #(board.warnings or {}) == 0 then
			table.insert(
				children,
				keyed(tern.ui.text({ tern.ui.span("no changes on the board", "muted") }), "empty")
			)
		end
		if hidden > 0 then
			local noun = hidden == 1 and "sprint" or "sprints"
			table.insert(
				children,
				keyed(
					tern.ui.text({ tern.ui.span(hidden .. " closed " .. noun .. " hidden (c to show).", "muted") }),
					"hidden"
				)
			)
		end
		if hiddenArchived > 0 then
			table.insert(
				children,
				keyed(
					tern.ui.text({ tern.ui.span(hiddenArchived .. " archived ungrouped change(s) hidden", "muted") }),
					"hidden-archived"
				)
			)
		end
		if hasSignal then
			table.insert(
				children,
				keyed(tern.ui.text({ tern.ui.span("Detail: spego board --gaps", "muted") }), "detail-hint")
			)
		end
		if sawObserved then
			table.insert(
				children,
				keyed(tern.ui.text({ tern.ui.span("* observed - median of recorded runs", "muted") }), "observed-hint")
			)
		end
		if sawPlanned then
			table.insert(
				children,
				keyed(
					tern.ui.text({ tern.ui.span("† planned - the plan's chunk count at the measured cost per chunk", "muted") }),
					"planned-hint"
				)
			)
		end
		if board.next ~= nil and type(board.next) == "table" then
			table.insert(children, keyed(tern.ui.text({
				tern.ui.span(
					"Suggestion: " .. tostring(board.next.change or "?") .. " in " .. tostring(board.next.sprint or "?")
						.. " - " .. tostring(board.next.reason or "") .. ".",
					"muted"
				),
			}), "next"))
		else
			table.insert(
				children,
				keyed(
					tern.ui.text({ tern.ui.span("Suggestion: groom pending changes into an active sprint-plan.", "muted") }),
					"next"
				)
			)
		end
		if st.detailsOpen then
			local details = renderDetails(st)
			if details ~= nil then
				table.insert(children, details)
			end
		end
	elseif st.loadError ~= nil then
		table.insert(children, keyed(tern.ui.text({ tern.ui.span(st.loadError, "strong error") }), "error"))
		table.insert(
			children,
			keyed(tern.ui.text({ tern.ui.span("press r or the Refresh button to retry", "muted") }), "retry")
		)
		table.insert(
			children,
			keyed(
				tern.ui.text({ tern.ui.span("close this block and reopen it from the spego project root", "muted") }),
				"reopen"
			)
		)
	end

	if st.loading then
		table.insert(controls, keyed(tern.ui.text({ tern.ui.span("loading…", "strong") }), "loading"))
	end
	local controlsRow = tern.ui.row(controls)
	local controlsProps: { [string]: any } = controlsRow.p or {}
	controlsProps.role = "spego.toolbar"
	controlsRow.p = controlsProps
	table.insert(children, 1, keyed(controlsRow, "controls"))

	return tern.ui.col(children)
end

tern.block.define("board", {
	init = function(cx, _args, saved): any
		local st: State = {
			pane = cx.pane,
			cx = cx,
			root = nil,
			rootError = nil,
			board = nil,
			loadError = nil,
			stale = false,
			loading = false,
			boardGen = 0,
			boardPending = false,
			taskGen = 0,
			tasks = nil,
			taskError = nil,
			taskChangeId = nil,
			selectedChangeId = nil,
			selectedSection = nil,
			detailsOpen = false,
			showArchived = false,
			showClosed = false,
		}
		if validSavedPreferences(saved) then
			if type(saved.selectedChangeId) == "string" then
				st.selectedChangeId = saved.selectedChangeId
			end
			if type(saved.selectedSection) == "string" then
				st.selectedSection = saved.selectedSection
			end
			if type(saved.detailsOpen) == "boolean" then
				st.detailsOpen = saved.detailsOpen
			end
			if type(saved.showArchived) == "boolean" then
				st.showArchived = saved.showArchived
			end
			if type(saved.showClosed) == "boolean" then
				st.showClosed = saved.showClosed
			end
			if isAbsolute(saved.root) then
				st.root = saved.root
			end
		end
		if st.root == nil and isAbsolute(cx.cwd) then
			st.root = cx.cwd
		end
		panes[cx.pane] = st
		if st.root == nil then
			st.rootError = "Spego needs the block opened from the project root: "
				.. "the pane's working directory is missing or relative"
			if type(cx.cwd) == "string" then
				st.rootError = st.rootError .. " (cwd: " .. cx.cwd .. ")"
			end
		else
			startLoad(st)
		end
		return st
	end,

	view = function(state, _cx)
		if state.rootError ~= nil then
			return {
				main = tern.ui.col({
					keyed(tern.ui.text({ tern.ui.span("Spego workspace error", "strong error") }), "head"),
					keyed(tern.ui.text({ tern.ui.span(state.rootError, nil) }), "msg"),
					keyed(
						tern.ui.text({ tern.ui.span(
							"close this block and reopen it from the spego project root",
							"muted"
						) }),
						"hint"
					),
				}),
			}
		end
		local main = renderBoard(state)
		if state.stale and state.board ~= nil then
			main = tern.ui.col({
				keyed(tern.ui.text({ tern.ui.span(
					"last refresh failed - showing the previous board: " .. tostring(state.loadError),
					"strong error"
				) }), "stale"),
				main,
			})
		end
		return { main = main }
	end,

	title = function(state)
		if state.root ~= nil then
			return "Spego Delivery Board"
		end
		return "Spego Delivery Board (no workspace)"
	end,

	key = function(state, key, _cx): boolean?
		if state.rootError ~= nil then
			return false
		end
		if key.name == "r" then
			startLoad(state)
			return true
		elseif key.name == "a" then
			state.showArchived = not state.showArchived
			if state.loading then
				state.boardPending = true
			else
				startLoad(state)
			end
			return true
		elseif key.name == "c" then
			state.showClosed = not state.showClosed
			return true
		elseif key.name == "escape" then
			if state.detailsOpen then
				state.detailsOpen = false
				state.taskGen += 1
				return true
			end
		elseif key.name == "d" then
			local target: Occurrence? = nil
			for _, occ in visibleOccurrences(state) do
				if occ.ch.id == state.selectedChangeId and occ.section == state.selectedSection then
					target = occ
					break
				end
			end
			if target == nil then
				target = visibleOccurrences(state)[1]
			end
			if target ~= nil then
				selectOccurrence(state, target.section, target.ch.id)
			end
			return true
		elseif key.name == "n" then
			return navigateDetails(state, 1)
		elseif key.name == "p" then
			return navigateDetails(state, -1)
		end
		return false
	end,

	event = function(state, ev, _cx)
		if state.rootError ~= nil then
			return
		end
		if ev.ev ~= "action" then
			return
		end
		local act = ev.act or ev.id
		if act == "refresh" then
			startLoad(state)
		elseif act == "toggle-archived" then
			state.showArchived = not state.showArchived
			if state.loading then
				state.boardPending = true
			else
				startLoad(state)
			end
		elseif act == "toggle-closed" then
			state.showClosed = not state.showClosed
		elseif act == "select" then
			local _, _, section, id = tostring(ev.value or ""):find("^(.-)\t(.+)$")
			if id ~= nil then
				selectOccurrence(state, section, id)
			end
		elseif act == "close-details" then
			state.detailsOpen = false
			state.taskGen += 1
		else
			for _, occ in visibleOccurrences(state) do
				if act == detailsAction(occ) then
					selectOccurrence(state, occ.section, occ.ch.id)
					break
				end
			end
		end
	end,

	save = function(state)
		return {
			version = 1,
			root = state.root,
			selectedChangeId = state.selectedChangeId,
			selectedSection = state.selectedSection,
			detailsOpen = state.detailsOpen,
			showArchived = state.showArchived,
			showClosed = state.showClosed,
		}
	end,
})
