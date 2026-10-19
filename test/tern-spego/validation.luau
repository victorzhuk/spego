local block = T.define()
local curCx: any = nil

local function hostInit(cwd: any, saved: any?): any
	curCx = T.cx(cwd)
	return block.init(curCx, nil, saved)
end

local function hostView(st: any): any
	return block.view(st, curCx or T.cx("/repo"))
end

local function hostKey(st: any, name: string): any
	return block.key(st, { name = name }, curCx)
end

local function hostSave(st: any): any
	return block.save(st)
end

local function deepCollect(node: any, out: { string })
	if type(node) ~= "table" then
		if node ~= nil then
			table.insert(out, tostring(node))
		end
		return
	end
	if node.main ~= nil then
		deepCollect(node.main, out)
		return
	end
	if node.text ~= nil then
		table.insert(out, tostring(node.text))
	end
	for _, key in { "spans", "children", "props", "rows", "cols" } do
		local list = node[key]
		if type(list) == "table" then
			for _, v in list do
				deepCollect(v, out)
			end
		end
	end
end

local function deepText(view: any): string
	local out: { string } = {}
	deepCollect(view, out)
	return table.concat(out, " ")
end

local function copy(t: any): any
	local c: any = {}
	for k, v in t do
		c[k] = v
	end
	return c
end

local function okResult(token: string): any
	return { stdout = token, stderr = "", status = 0, timed_out = false }
end

local function hasDiagnostic(t: string): boolean
	return t:find("stale", 1, true) ~= nil
		or t:find("must be", 1, true) ~= nil
		or t:find("failed", 1, true) ~= nil
		or t:find("error", 1, true) ~= nil
end

local function validChange(id: string): any
	return {
		id = id,
		slug = id,
		title = "Change " .. id,
		status = "open",
		group = "g1",
		archived = false,
		blockers = {},
		missing = {},
		warnings = {},
		gaps = {},
	}
end

local function validBoard(): any
	local ch = validChange("c1")
	ch.taskCount = 2
	ch.tasksDone = 0
	local un = validChange("u1")
	return {
		sprints = {
			{
				slug = "s1",
				title = "Sprint One",
				status = "active",
				complete = false,
				missing = {},
				changes = { ch },
			},
		},
		ungrouped = { un },
		warnings = {},
	}
end

local function validTasks(): any
	return {
		{ externalId = "t1", title = "Task one", status = "done" },
		{ externalId = "t2", title = "Task two", status = "pending" },
		{ externalId = "t3", title = "Task three", status = "unknown" },
	}
end

local function loadBoard(board: any): any
	T.json("board", board)
	local st = hostInit("/repo")
	T.assert(#T.requests() == 1, "init should issue exactly one board request")
	T.complete(T.pending(), okResult("board"))
	return st
end

local function refreshText(st: any, board: any): string
	T.json("b2", board)
	hostKey(st, "r")
	T.assert(#T.requests() == 2, "refresh should issue a board request")
	T.complete(T.pending(), okResult("b2"))
	return T.text(hostView(st))
end

local function initialText(board: any): string
	T.reset()
	T.json("board", board)
	local st = hostInit("/repo")
	T.complete(T.pending(), okResult("board"))
	return T.text(hostView(st))
end

local function scenario(name: string, fn: any)
	T.reset()
	local ok, err = pcall(fn)
	T.assert(ok, name .. " raised: " .. tostring(err))
end

scenario("positive control", function()
	local t = initialText(validBoard())
	T.assert(t:find("Sprint One", 1, true) ~= nil, "accepted board should render Sprint One")
end)

local malformedVariants: { { name: string, board: any } } = {}
local function addVariant(name: string, mutate: any)
	local b = validBoard()
	mutate(b)
	table.insert(malformedVariants, { name = name, board = b })
end

addVariant("sprints scalar", function(b: any)
	b.sprints = 5
end)
addVariant("ungrouped scalar", function(b: any)
	b.ungrouped = "x"
end)
addVariant("warnings scalar", function(b: any)
	b.warnings = 7
end)
addVariant("sprints hole", function(b: any)
	local s = b.sprints[1]
	b.sprints = { [2] = s }
end)
addVariant("sprints string key", function(b: any)
	local s = b.sprints[1]
	b.sprints = { s, extra = copy(s) }
end)
addVariant("sprint changes scalar", function(b: any)
	b.sprints[1].changes = 5
end)
addVariant("sprint missing complete", function(b: any)
	b.sprints[1].complete = nil
end)
addVariant("change non-string id", function(b: any)
	b.sprints[1].changes[1].id = 5
end)
addVariant("change empty slug", function(b: any)
	b.sprints[1].changes[1].slug = ""
end)
addVariant("gaps non-object", function(b: any)
	b.sprints[1].changes[1].gaps = { 7 }
end)
addVariant("gap non-string flag", function(b: any)
	b.sprints[1].changes[1].gaps = { { flag = 5 } }
end)
addVariant("board warning scalar entry", function(b: any)
	b.warnings = { 5 }
end)
addVariant("board warning bad code", function(b: any)
	b.warnings = { { code = 1, message = "m" } }
end)
addVariant("next scalar", function(b: any)
	b.next = 5
end)
addVariant("next missing fields", function(b: any)
	b.next = { change = "c1" }
end)
addVariant("sprints null entry", function(b: any)
	local s = b.sprints[1]
	b.sprints = { s, tern.json.null }
end)
addVariant("missing scalar entry", function(b: any)
	b.sprints[1].changes[1].missing = { 5 }
end)

for _, v in malformedVariants do
	scenario("rejects " .. v.name, function()
		local st = loadBoard(validBoard())
		local t = refreshText(st, v.board)
		T.assert(t:find("Sprint One", 1, true) ~= nil, "previous board should stay rendered")
		T.assert(t:find("loading", 1, true) == nil, "loading should clear after failed refresh")
		T.assert(hasDiagnostic(t), "view should carry a diagnostic after malformed refresh")
	end)
end

scenario("container message not an object", function()
	local t = initialText(5)
	T.assert(t:find("board payload is not an object", 1, true) ~= nil, "exact container message expected")
end)

scenario("container message no sprints", function()
	local b = validBoard()
	b.sprints = nil
	local t = initialText(b)
	T.assert(t:find("board payload has no sprints array", 1, true) ~= nil, "exact container message expected")
end)

scenario("container message no ungrouped", function()
	local b = validBoard()
	b.ungrouped = nil
	local t = initialText(b)
	T.assert(t:find("board payload has no ungrouped array", 1, true) ~= nil, "exact container message expected")
end)

local badCounts: { { name: string, mutate: any } } = {
	{
		name = "one-sided count",
		mutate = function(ch: any)
			ch.taskCount = nil
		end,
	},
	{
		name = "negative count",
		mutate = function(ch: any)
			ch.taskCount = -1
			ch.tasksDone = 0
		end,
	},
	{
		name = "fractional count",
		mutate = function(ch: any)
			ch.taskCount = 1.5
			ch.tasksDone = 0
		end,
	},
	{
		name = "done exceeds total",
		mutate = function(ch: any)
			ch.taskCount = 1
			ch.tasksDone = 2
		end,
	},
}

for _, v in badCounts do
	scenario("rejects " .. v.name, function()
		local b = validBoard()
		v.mutate(b.sprints[1].changes[1])
		local st = loadBoard(validBoard())
		local t = refreshText(st, b)
		T.assert(t:find("Sprint One", 1, true) ~= nil, "previous board should stay rendered")
		T.assert(hasDiagnostic(t), "view should carry a diagnostic")
		if v.name == "done exceeds total" then
			T.assert(t:find("tasksDone must not exceed taskCount", 1, true) ~= nil, "exact count message expected")
		end
	end)
end

scenario("accepts absent count pair", function()
	local b = validBoard()
	b.sprints[1].changes[1].taskCount = nil
	b.sprints[1].changes[1].tasksDone = nil
	local t = initialText(b)
	T.assert(t:find("Sprint One", 1, true) ~= nil, "board should render")
	T.assert(not hasDiagnostic(t), "no diagnostic expected")
end)

scenario("accepts zero counts", function()
	local b = validBoard()
	b.sprints[1].changes[1].taskCount = 0
	b.sprints[1].changes[1].tasksDone = 0
	local t = initialText(b)
	T.assert(t:find("Sprint One", 1, true) ~= nil, "board should render")
	T.assert(not hasDiagnostic(t), "no diagnostic expected")
end)

scenario("accepts and renders 2/10", function()
	local b = validBoard()
	b.sprints[1].changes[1].taskCount = 10
	b.sprints[1].changes[1].tasksDone = 2
	T.reset()
	T.json("board", b)
	local state = hostInit("/repo")
	T.complete(T.pending(), okResult("board"))
	hostKey(state, "d")
	T.assert(#T.requests() == 2, "opening details should start tasks")
	T.json("tasks", validTasks())
	T.complete(T.pending(), okResult("tasks"))
	local t = deepText(hostView(state))
	T.assert(t:find("2/10", 1, true) ~= nil, "accepted counts should render as 2/10")
end)

local badTasks: { { name: string, tasks: any } } = {
	{ name = "scalar task entry", tasks = { 5 } },
	{ name = "task missing title", tasks = { { externalId = "t1", status = "done" } } },
	{ name = "task missing externalId", tasks = { { title = "T", status = "done" } } },
	{ name = "unknown task status", tasks = { { externalId = "t1", title = "T", status = "weird" } } },
}

for _, v in badTasks do
	scenario("rejects " .. v.name, function()
		local st = loadBoard(validBoard())
		hostKey(st, "d")
		T.assert(#T.requests() == 2, "opening details should start tasks")
		T.json("tasks", v.tasks)
		T.complete(T.pending(), okResult("tasks"))
		local t = T.text(hostView(st))
		T.assert(t:find("Sprint One", 1, true) ~= nil, "board rows should stay rendered")
		T.assert(hasDiagnostic(t), "details should show a task error")
	end)
end

scenario("accepts valid task statuses", function()
	local st = loadBoard(validBoard())
	hostKey(st, "d")
	T.json("tasks", validTasks())
	T.complete(T.pending(), okResult("tasks"))
	local t = T.text(hostView(st))
	local v = hostView(st)
	T.assert(t:find("Sprint One", 1, true) ~= nil, "board rows should stay rendered")
	T.assert(t:find("must be", 1, true) == nil, "no validation diagnostic expected")
	T.assert(t:find("Task one", 1, true) ~= nil, "details should render accepted task one")
	T.assert(t:find("Task two", 1, true) ~= nil, "details should render accepted task two")
	T.assert(t:find("Task three", 1, true) ~= nil, "details should render accepted task three")
	T.assert(T.find(v, "task-err") == nil, "accepted tasks must not set the task-error node")
end)

scenario("renders gap flag and note", function()
	local b = validBoard()
	b.sprints[1].changes[1].gaps = { { flag = "no-task-plan", note = "plan missing" } }
	T.reset()
	T.json("board", b)
	local state = hostInit("/repo")
	T.complete(T.pending(), okResult("board"))
	hostKey(state, "d")
	T.json("tasks", validTasks())
	T.complete(T.pending(), okResult("tasks"))
	local t = deepText(hostView(state))
	T.assert(t:find("no-task-plan: plan missing", 1, true) ~= nil, "gap should render flag and note")
	T.assert(t:find("table: ", 1, true) == nil, "gap must never render as table identity")
end)

local function discoverSelectionKeys(): { string }
	T.reset()
	local st = loadBoard(validBoard())
	hostKey(st, "d")
	local s = hostSave(st)
	local known = {
		version = true,
		root = true,
		showArchived = true,
		showClosed = true,
		detailsOpen = true,
	}
	local keys: { string } = {}
	for k in s do
		if not known[k] then
			table.insert(keys, k)
		end
	end
	T.assert(#keys == 2, "expected two selection keys in save output, got " .. #keys)
	return keys
end

local selectionKeys = discoverSelectionKeys()
local kA, kB = selectionKeys[1], selectionKeys[2]

local badSaved: { { name: string, saved: any } } = {
	{ name = "numeric root", saved = { version = 1, root = 5, showArchived = true, showClosed = true, detailsOpen = false } },
	{ name = "boolean root", saved = { version = 1, root = true, showArchived = true, showClosed = true, detailsOpen = false } },
	{ name = "table root", saved = { version = 1, root = {}, showArchived = true, showClosed = true, detailsOpen = false } },
	{ name = "relative root", saved = { version = 1, root = "rel/path", showArchived = true, showClosed = true, detailsOpen = false } },
	{ name = "wrong version", saved = { version = 2, showArchived = true, showClosed = true, detailsOpen = true } },
	{ name = "string version", saved = { version = "1", showArchived = true, showClosed = true, detailsOpen = true } },
	{ name = "missing boolean", saved = { version = 1, showClosed = true, detailsOpen = true } },
	{ name = "open details without selection", saved = { version = 1, showArchived = true, showClosed = true, detailsOpen = true } },
}

local oneSided: any = { version = 1, showArchived = true, showClosed = true, detailsOpen = false }
oneSided[kA] = "ungrouped"
table.insert(badSaved, { name = "one-sided selection", saved = oneSided })

local badSection: any = { version = 1, showArchived = true, showClosed = true, detailsOpen = false }
badSection[kA] = "bogus-section"
badSection[kB] = "c1"
table.insert(badSaved, { name = "invalid section format", saved = badSection })

for _, v in badSaved do
	scenario("resets preferences: " .. v.name, function()
		T.reset()
		local st = hostInit("/repo", v.saved)
		local s = hostSave(st)
		T.eq(s.version, 1, v.name .. ": version")
		T.eq(s.root, "/repo", v.name .. ": root defaults to cwd")
		T.eq(s.showArchived, false, v.name .. ": showArchived default")
		T.eq(s.showClosed, false, v.name .. ": showClosed default")
		T.eq(s.detailsOpen, false, v.name .. ": detailsOpen default")
		local n = 0
		for _ in s do
			n += 1
		end
		T.eq(n, 5, v.name .. ": selection must be cleared")
		T.eq(#T.requests(), 1, v.name .. ": exactly one board request")
	end)
end

scenario("valid saved root precedence", function()
	T.reset()
	local saved = { version = 1, root = "/saved", showArchived = false, showClosed = false, detailsOpen = false }
	hostInit("/other", saved)
	T.eq(#T.requests(), 1, "one board request expected")
	T.eq(T.requests()[1].cwd, "/saved", "request should use saved root")
end)

scenario("valid saved absent root uses cwd", function()
	T.reset()
	local saved = { version = 1, showArchived = false, showClosed = false, detailsOpen = false }
	hostInit("/repo", saved)
	T.eq(#T.requests(), 1, "one board request expected")
	T.eq(T.requests()[1].cwd, "/repo", "request should use absolute cwd")
end)

scenario("relative cwd starts no process", function()
	T.reset()
	local st = hostInit("relative/path")
	T.eq(#T.requests(), 0, "no process should start for a relative cwd")
	local t = T.text(hostView(st))
	T.assert(t:find("workspace", 1, true) ~= nil, "workspace error expected")
end)

print("validation: all scenarios passed")
