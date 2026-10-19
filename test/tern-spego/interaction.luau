local function ok(token: string): any
	return { stdout = token, stderr = "", status = 0, timed_out = false }
end

local function changeRow(id: string, slug: string, title: string, status: string): any
	return {
		id = id,
		slug = slug,
		title = title,
		status = status,
		group = "delivery",
		archived = false,
		blockers = {},
		missing = {},
		warnings = {},
		gaps = {},
	}
end

local function sprintA(): any
	local c = changeRow("c1", "one", "Alpha One", "in-progress")
	c.taskCount = 1
	c.tasksDone = 0
	c.planState = "planned"
	return { slug = "sA", title = "Alpha", status = "active", complete = false, changes = { c }, missing = {} }
end

local function sprintZ(): any
	local c = changeRow("c1", "one", "Zeta One", "done")
	return { slug = "sZ", title = "Zeta", status = "closed", complete = true, changes = { c }, missing = {} }
end

local function sprintB(): any
	local c = changeRow("c3", "three", "Beta Three", "in-progress")
	c.taskCount = 1
	c.tasksDone = 0
	return { slug = "sB", title = "Beta", status = "active", complete = false, changes = { c }, missing = {} }
end

local function ungroupedC2(archived: boolean?): any
	local c = changeRow("c2", "two", "Change Two", "backlog")
	c.archived = archived == true
	c.taskCount = 0
	c.tasksDone = 0
	return c
end

local function validBoard(sprints: { any }, ungrouped: { any }): any
	return { sprints = sprints, ungrouped = ungrouped, warnings = {} }
end

local function savedDefaults(): any
	return { version = 1, showArchived = false, showClosed = false, detailsOpen = false }
end

local function taskList(title: string): any
	return { { externalId = "t1", title = title, status = "pending" } }
end

local function loadBoard(board: any): any
	T.json("board-token", board)
	local base = #T.requests()
	local st = T.init("/repo", savedDefaults())
	T.eq(#T.requests(), base + 1, "initialization creates exactly one request")
	T.complete(T.pending(), ok("board-token"))
	return st
end

local function viewText(st: any): string
	return T.text(T.view(st))
end

local function menuEntries(view: any): { any }
	local node = T.find(view, "open-details")
	T.assert(node ~= nil, "open-details control missing")
	T.assert(type(node.p.actions) == "table", "open-details carries no actions")
	return node.p.actions.menu
end

-- scenario 1: positive control, title, toolbar, exact menu
do
	T.json("tasks-1", taskList("Task One"))
	local st = loadBoard(validBoard({ sprintA(), sprintZ() }, { ungroupedC2(false) }))

	local view = T.view(st)
	T.assert(T.find(view, "title") == nil, "internal title node must not render")
	T.eq(T.title(st), "Spego Delivery Board", "block title hook value")
	local toolbar = T.findRole(view, "spego.toolbar")
	T.assert(toolbar ~= nil, "controls row with role spego.toolbar missing")
	T.assert(T.find(view, "refresh") ~= nil, "refresh button missing")
	T.assert(T.find(view, "toggle-archived") ~= nil, "toggle-archived button missing")
	T.assert(T.find(view, "toggle-closed") ~= nil, "toggle-closed button missing")

	local menu = menuEntries(view)
	T.eq(#menu, 2, "menu lists exactly the visible occurrences")
	T.eq(menu[1], 'open "sprint:sA" "c1" one', "first menu entry")
	T.eq(menu[2], 'open "ungrouped" "c2" two', "second menu entry")
end

-- scenario 2: visible duplicate wins, select event, reordered refresh retention
do
	local base = #T.requests()
	T.json("tasks-a", taskList("Task One"))
	local st = loadBoard(validBoard({ sprintA(), sprintZ() }, { ungroupedC2(false) }))

	T.event(st, { ev = "action", act = 'open "sprint:sA" "c1" one' })
	T.eq(#T.requests(), base + 2, "menu action starts task request")
	T.complete(T.pending(), ok("tasks-a"))
	local txt = viewText(st)
	T.assert(string.find(txt, "Task One", 1, true) ~= nil, "details render selected task")
	T.assert(string.find(txt, "Zeta One", 1, true) == nil, "hidden Zeta occurrence must never render or select")

	T.key(st, "escape")

	T.event(st, { ev = "action", act = "select", value = "sprint:sA\tc1" })
	T.eq(#T.requests(), base + 3, "select event starts task request")
	T.complete(T.pending(), ok("tasks-a"))
	txt = viewText(st)
	T.assert(string.find(txt, "Task One", 1, true) ~= nil, "select event opens details")
	T.assert(string.find(txt, "Zeta One", 1, true) == nil, "select event must not pick the hidden duplicate")

	T.key(st, "r")
	T.json("board-reordered", validBoard({ sprintZ(), sprintA() }, { ungroupedC2(false) }))
	T.eq(#T.requests(), base + 4, "refresh starts one board request")
	T.complete(T.pending(), ok("board-reordered"))
	T.eq(#T.requests(), base + 5, "open details request tasks for the accepted snapshot")
	T.complete(T.pending(), ok("tasks-a"))
	txt = viewText(st)
	T.assert(string.find(txt, "Task One", 1, true) ~= nil, "details survive reordered refresh")
	T.assert(string.find(txt, "Zeta One", 1, true) == nil, "reordered refresh must keep the Alpha section selected")
end

-- scenario 3: obsolete and malformed actions change nothing
do
	T.json("tasks-3", taskList("Task One"))
	local st = loadBoard(validBoard({ sprintA(), sprintZ() }, { ungroupedC2(false) }))

	T.event(st, { ev = "action", act = 'open "sprint:sA" "c1" one' })
	T.complete(T.pending(), ok("tasks-3"))
	local before = viewText(st)
	local renders = T.renderCount()
	local reqs = #T.requests()

	T.event(st, { ev = "action", act = 'open "sprint:gone" "c9" vanished' })
	T.event(st, { ev = "action", act = "select", value = "sprint:sZ\tc1" })
	T.event(st, { ev = "action", act = "select", value = "wrong-section\tc1" })
	T.event(st, { ev = "action", act = "select", value = "sprint:sA" })

	T.eq(#T.requests(), reqs, "stale and malformed actions start no request")
	T.eq(T.renderCount(), renders, "stale and malformed actions trigger no render")
	T.eq(viewText(st), before, "stale and malformed actions leave the view unchanged")
end

-- scenario 4: keyboard path with boundaries and no duplicate task request
do
	local base = #T.requests()
	T.json("tasks-4a", taskList("Task One"))
	T.json("tasks-4b", taskList("Task For Two"))
	local board4 = validBoard({ sprintA(), sprintZ() }, { ungroupedC2(false) })
	board4.ungrouped[1].taskCount = 1
	local st = loadBoard(board4)

	T.assert(T.key(st, "d") == true, "d opens the first visible occurrence and is consumed")
	T.eq(#T.requests(), base + 2, "d starts one task request")
	T.complete(T.pending(), ok("tasks-4a"))
	local txt = viewText(st)
	T.assert(string.find(txt, "Task One", 1, true) ~= nil, "d opens details on the first visible occurrence")

	T.assert(T.key(st, "p") == true, "p at the first occurrence is consumed")
	T.eq(#T.requests(), base + 2, "p at the boundary starts no task request and does not wrap")
	T.assert(string.find(viewText(st), "Task One", 1, true) ~= nil, "p at the boundary keeps details")

	T.assert(T.key(st, "n") == true, "n moves forward")
	T.eq(#T.requests(), base + 3, "n starts one task request")
	T.complete(T.pending(), ok("tasks-4b"))
	T.assert(string.find(viewText(st), "Task For Two", 1, true) ~= nil, "n opens the second visible occurrence")

	T.assert(T.key(st, "n") == true, "n at the last occurrence is consumed")
	T.eq(#T.requests(), base + 3, "n at the boundary starts no task request and does not wrap")

	T.assert(T.key(st, "p") == true, "p moves backward")
	T.eq(#T.requests(), base + 4, "p starts one task request")
	T.complete(T.pending(), ok("tasks-4a"))
	T.assert(string.find(viewText(st), "Task One", 1, true) ~= nil, "p returns to the first visible occurrence")

	T.assert(T.key(st, "d") == true, "re-selecting the open pair is consumed")
	T.eq(#T.requests(), base + 4, "re-selecting the already-open pair issues no second task request")
end

-- scenario 4b: no visible occurrences
do
	local base = #T.requests()
	local st = loadBoard(validBoard({ sprintZ() }, {}))

	local view = T.view(st)
	T.assert(T.find(view, "open-details") == nil, "no visible changes means no details menu")
	T.assert(T.key(st, "d") == true, "d with no visible rows is consumed")
	T.eq(#T.requests(), base + 1, "d with no visible rows starts no task request")
end

-- scenario 5: filter-hidden selection retained, n picks first visible, p picks last visible
do
	local base = #T.requests()
	T.json("tasks-5a", taskList("Task One"))
	T.json("tasks-5b", taskList("Task For Two"))
	local c4 = changeRow("c4", "four", "Done Four", "done")
	c4.taskCount = 1
	c4.tasksDone = 0
	local sprintD = { slug = "sD", title = "Done", status = "closed", complete = true, changes = { c4 }, missing = {} }
	local saved = savedDefaults()
	saved.showClosed = true
	local board5 = validBoard({ sprintA(), sprintD, sprintB() }, { ungroupedC2(false) })
	board5.ungrouped[1].taskCount = 1
	T.json("board-5", board5)
	local st = T.init("/repo", saved)
	T.complete(T.pending(), ok("board-5"))

	local view5 = T.view(st)
	T.assert(T.find(view5, "open-details") ~= nil, "scenario 5 menu missing")

	T.event(st, { ev = "action", act = 'open "sprint:sD" "c4" four' })
	T.eq(#T.requests(), base + 1, "finished change opens details without a task request")
	T.assert(string.find(viewText(st), "Done Four", 1, true) ~= nil, "closed-sprint row is selectable while shown")

	T.key(st, "c")
	T.assert(string.find(viewText(st), "Done Four", 1, true) ~= nil, "hiding the row must not clear the accepted selection")
	T.eq(#T.requests(), base + 1, "filter toggle starts no request")

	T.assert(T.key(st, "n") == true, "n from a hidden selection is consumed")
	T.eq(#T.requests(), base + 2, "n from a hidden selection starts the first visible task request")
	T.complete(T.pending(), ok("tasks-5a"))
	local afterN = viewText(st)
	T.assert(string.find(afterN, "Task One", 1, true) ~= nil, "n opens the first visible occurrence")
	T.assert(string.find(afterN, "Done Four", 1, true) == nil, "n replaces the hidden selection in details")

	T.key(st, "escape")
	T.key(st, "c")
	T.event(st, { ev = "action", act = 'open "sprint:sD" "c4" four' })
	T.eq(#T.requests(), base + 2, "reopening the finished change starts no task request")
	T.key(st, "c")
	T.assert(string.find(viewText(st), "Done Four", 1, true) ~= nil, "details survive re-hiding the pair")

	T.assert(T.key(st, "p") == true, "p from a hidden selection is consumed")
	T.eq(#T.requests(), base + 3, "p from a hidden selection starts the last visible task request")
	T.complete(T.pending(), ok("tasks-5b"))
	T.assert(string.find(viewText(st), "Task For Two", 1, true) ~= nil, "p opens the last visible occurrence")
end

-- scenario 6: initial pending and failed load states
do
	T.json("board-6", validBoard({ sprintA() }, { ungroupedC2(false) }))
	local st = T.init("/repo", savedDefaults())

	local view = T.view(st)
	T.assert(T.find(view, "loading") ~= nil, "pending initial load renders loading")
	T.assert(T.find(view, "refresh") ~= nil, "pending initial load renders refresh")
	T.assert(T.find(view, "open-details") == nil, "pending initial load renders no board sections")
	T.assert(T.find(view, "sprint:sA") == nil, "pending initial load renders no sprint card")
	T.assert(T.find(view, "ungrouped") == nil, "pending initial load renders no ungrouped card")

	T.complete(T.pending(), { stdout = "", stderr = "spego failed", status = 1, timed_out = false })
	view = T.view(st)
	T.assert(T.find(view, "error") ~= nil, "failed load renders the diagnostic")
	T.assert(T.find(view, "retry") ~= nil, "failed load renders retry advice")
	local reopen = T.find(view, "reopen")
	T.assert(reopen ~= nil, "failed load renders reopen guidance")
	T.eq(T.text(reopen), "close this block and reopen it from the spego project root", "reopen text")
	T.assert(T.find(view, "refresh") ~= nil, "failed load keeps refresh")

	-- positive control: the same row-absence signal flips once the board is accepted
	T.json("board-6-ok", validBoard({ sprintA() }, { ungroupedC2(false) }))
	local st2 = T.init("/repo", savedDefaults())
	T.complete(T.pending(), ok("board-6-ok"))
	local view2 = T.view(st2)
	T.assert(T.find(view2, "sprint:sA") ~= nil, "accepted board renders the sprint card")
	T.assert(T.find(view2, "ungrouped") ~= nil, "accepted board renders the ungrouped card")
end

-- scenario 7: escape closes details and is inert when closed
do
	T.json("tasks-7", taskList("Task One"))
	local st = loadBoard(validBoard({ sprintA(), sprintZ() }, { ungroupedC2(false) }))

	T.key(st, "d")
	T.complete(T.pending(), ok("tasks-7"))
	T.assert(string.find(viewText(st), "Task One", 1, true) ~= nil, "details open before escape")

	T.assert(T.key(st, "escape") == true, "escape closes open details")
	T.assert(string.find(viewText(st), "Task One", 1, true) == nil, "details content disappears after escape")

	local renders = T.renderCount()
	T.assert(T.key(st, "escape") == false, "escape with closed details is unhandled")
	T.eq(T.renderCount(), renders, "escape with closed details renders nothing")
end
