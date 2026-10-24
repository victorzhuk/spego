local tokenSeq = 0

local function boardToken(value: any): string
	tokenSeq += 1
	local tok = "board" .. tostring(tokenSeq)
	T.json(tok, value)
	return tok
end

local function taskToken(value: any): string
	tokenSeq += 1
	local tok = "tasks" .. tostring(tokenSeq)
	T.json(tok, value)
	return tok
end

local function okResult(token: string): any
	return { stdout = token, stderr = "", status = 0, timed_out = false }
end

local failResult: any = { stdout = "", stderr = "boom", status = 1, timed_out = false }

local function finish(index: number, result: any)
	return T.complete(index, result)
end

local function validBoard(): any
	return {
		sprints = {
			{
				slug = "s1",
				title = "Sprint One",
				status = "active",
				startDate = "2026-01-01",
				endDate = "2026-01-14",
				complete = false,
				missing = {},
				changes = {
					{
						id = "c1",
						slug = "change-one",
						title = "change-one",
						status = "in-progress",
						group = "track-a",
						archived = false,
						blockers = {},
						missing = {},
						warnings = {},
						gaps = {},
						taskCount = 2,
						tasksDone = 1,
						planState = "planned",
					},
				},
			},
		},
		ungrouped = {
			{
				id = "c2",
				slug = "change-two",
				title = "Change Two",
				status = "backlog",
				group = "",
				archived = false,
				blockers = {},
				missing = {},
				warnings = {},
				gaps = {},
				taskCount = 0,
				tasksDone = 0,
				planState = "none",
			},
		},
		warnings = {},
		next = { change = "c1", sprint = "s1", reason = "ready" },
	}
end

local function tasksA(): any
	return {
		{ externalId = "T-1", title = "Task Alpha", status = "pending" },
		{ externalId = "T-2", title = "Task Beta", status = "done" },
	}
end

local function tasksB(): any
	return {
		{ externalId = "T-3", title = "Task Gamma", status = "done" },
	}
end

local function has(s: string, sub: string): boolean
	return string.find(s, sub, 1, true) ~= nil
end

local function cellText(cell: any): string
	local out: { string } = {}
	local function flat(n: any)
		if type(n) ~= "table" then
			if n ~= nil then
				table.insert(out, tostring(n))
			end
			return
		end
		if n.text ~= nil then
			table.insert(out, tostring(n.text))
		end
		for _, k in ({ "spans", "children", "main" }) do
			local v = n[k]
			if type(v) == "table" then
				if k == "main" then
					flat(v)
				else
					for _, c in v do
						flat(c)
					end
				end
			end
		end
	end
	if type(cell) ~= "table" then
		return tostring(cell)
	end
	flat(cell)
	return table.concat(out, " ")
end

local function viewText(st: any): string
	local view = T.view(st)
	local parts: { string } = { T.text(view) }
	local function walk(n: any)
		if type(n) ~= "table" then
			return
		end
		if type(n.props) == "table" and n.props.rows ~= nil then
			for _, row in n.props.rows do
				for _, c in row do
					table.insert(parts, cellText(c))
				end
			end
		end
		for _, k in ({ "main", "children", "spans" }) do
			local v = n[k]
			if type(v) == "table" then
				if k == "main" then
					walk(v)
				else
					for _, c in v do
						walk(c)
					end
				end
			end
		end
	end
	walk(view)
	return table.concat(parts, " ")
end

local function freshInit(): (any, number)
	local n0 = #T.requests()
	T.eq(T.pending(), 0, "callbacks drained before scenario")
	local st = T.init("/repo")
	T.eq(#T.requests(), n0 + 1, "exactly one board request after init")
	return st, n0 + 1
end

local function loadBoard(): (any, number)
	local st, boardIdx = freshInit()
	finish(1, okResult(boardToken(validBoard())))
	return st, boardIdx
end

local function openDetails(st: any, lastIdx: number): number
	T.key(st, "d")
	local taskIdx = lastIdx + 1
	T.eq(#T.requests(), taskIdx, "task request after opening details")
	local argv = T.requests()[taskIdx].argv
	T.eq(#argv, 6, "task argv length")
	T.eq(argv[1], "spego", "task argv[1]")
	T.eq(argv[2], "--json", "task argv[2]")
	T.eq(argv[3], "tasks", "task argv[3]")
	T.eq(argv[4], "change-one", "task argv slug")
	T.eq(argv[5], "--cwd", "task argv cwd flag")
	T.eq(argv[6], "/repo", "task argv cwd")
	return taskIdx
end

do
	local st, boardIdx = freshInit()
	local argv = T.requests()[boardIdx].argv
	T.eq(#argv, 6, "board argv length")
	T.eq(argv[1], "spego", "board argv[1]")
	T.eq(argv[2], "--json", "board argv[2]")
	T.eq(argv[3], "board", "board argv[3]")
	T.eq(argv[4], "--fresh", "board argv[4]")
	T.eq(argv[5], "--cwd", "board argv cwd flag")
	T.eq(argv[6], "/repo", "board argv cwd")
	finish(1, okResult(boardToken(validBoard())))
	local txt = viewText(st)
	T.assert(has(txt, "Sprint One"), "rendered text names the sprint")
	T.assert(has(txt, "change-one"), "rendered text names the change")
	T.assert(not has(txt, "loading"), "loading indicator cleared after acceptance")
end

do
	local n0 = #T.requests()
	local a = T.init("/repo")
	T.eq(#T.requests(), n0 + 1, "state A board request")
	local b = T.init("/repo")
	T.eq(#T.requests(), n0 + 2, "state B board request")
	local rc = T.renderCount()
	finish(1, okResult(boardToken(validBoard())))
	T.eq(T.renderCount(), rc, "stale callback caused no render")
	T.eq(T.pending(), 1, "replacement callback survives stale completion")
	T.eq(#T.requests(), n0 + 2, "stale completion issued no request")
	finish(1, okResult(boardToken(validBoard())))
	local txt = T.text(T.view(b))
	T.assert(has(txt, "Sprint One"), "state B renders accepted board")
	T.eq(T.pending(), 0, "all callbacks consumed")
end

do
	local st, boardIdx = loadBoard()
	local taskIdx = openDetails(st, boardIdx)
	finish(1, okResult(taskToken(tasksA())))
	local txt = viewText(st)
	T.assert(has(txt, "Task Alpha"), "accepted task title rendered")
	T.key(st, "r")
	local refreshIdx = taskIdx + 1
	T.eq(#T.requests(), refreshIdx, "refresh issued one board request")
	finish(1, failResult)
	local after = viewText(st)
	T.assert(has(after, "change-one"), "board rows survive failed refresh")
	T.assert(has(after, "Task Alpha"), "task text survives failed refresh")
	T.assert(has(after, "last refresh failed"), "stale indication after failed refresh")
end

do
	local st, boardIdx = loadBoard()
	local taskIdx = openDetails(st, boardIdx)
	finish(1, okResult(taskToken(tasksA())))
	T.failNextStart()
	T.key(st, "r")
	T.eq(#T.requests(), taskIdx, "failed start recorded no request")
	local after = viewText(st)
	T.assert(has(after, "change-one"), "board rows survive process-start failure")
	T.assert(has(after, "Task Alpha"), "task text survives process-start failure")
	T.assert(has(after, "last refresh failed"), "stale indication after process-start failure")
end

do
	local st, boardIdx = loadBoard()
	local taskIdx = openDetails(st, boardIdx)
	local refreshIdx = taskIdx + 1
	T.key(st, "r")
	T.eq(#T.requests(), refreshIdx, "refresh board request pending")
	finish(1, okResult(taskToken(tasksA())))
	local txt = viewText(st)
	T.assert(has(txt, "Task Alpha"), "current task completion renders")
	finish(1, okResult(boardToken(validBoard())))
	local mid = viewText(st)
	T.assert(has(mid, "change-one"), "board rows after replacement snapshot")
	T.assert(not has(mid, "Task Alpha"), "task state cleared on snapshot acceptance")
	T.eq(#T.requests(), refreshIdx + 1, "tasks re-requested after snapshot acceptance")
	finish(1, okResult(taskToken(tasksB())))
	local done = viewText(st)
	T.assert(has(done, "Task Gamma"), "replacement tasks render")
	T.assert(not has(done, "Task Alpha"), "stale task value never appears")
end

do
	local st, boardIdx = loadBoard()
	local taskIdx = openDetails(st, boardIdx)
	local refreshIdx = taskIdx + 1
	T.key(st, "r")
	finish(2, okResult(boardToken(validBoard())))
	T.eq(#T.requests(), refreshIdx + 1, "new task request after snapshot acceptance")
	finish(1, okResult(taskToken(tasksA())))
	local mid = viewText(st)
	T.assert(not has(mid, "Task Alpha"), "superseded task completion ignored")
	finish(1, okResult(taskToken(tasksB())))
	local done = viewText(st)
	T.assert(has(done, "Task Gamma"), "current snapshot tasks render")
	T.assert(not has(done, "Task Alpha"), "superseded task value never appears")
end

do
	local st, boardIdx = loadBoard()
	local taskIdx = openDetails(st, boardIdx)
	local refreshIdx = taskIdx + 1
	T.key(st, "r")
	finish(2, failResult)
	local after = viewText(st)
	T.assert(has(after, "change-one"), "board rows survive failed replacement")
	finish(1, okResult(taskToken(tasksA())))
	local done = viewText(st)
	T.assert(has(done, "Task Alpha"), "retained snapshot accepts its task completion")
end

do
	local st, boardIdx = loadBoard()
	local taskIdx = openDetails(st, boardIdx)
	T.event(st, { ev = "action", act = "select", value = "ungrouped\tc2" })
	T.eq(#T.requests(), taskIdx, "known-empty plan starts no process")
	T.eq(st.selectedChangeId, "c2", "selected change after selecting c2")
	T.eq(st.selectedSection, "ungrouped", "selected section after selecting c2")
	T.event(st, { ev = "action", act = "select", value = "sprint:s1\tc1" })
	local c1TaskIdx = taskIdx + 1
	T.eq(#T.requests(), c1TaskIdx, "selecting sprint change with tasks requests them")
	finish(1, okResult(taskToken(tasksA())))
	local mid = viewText(st)
	T.assert(not has(mid, "Task Alpha"), "late task completion ignored after reselection")
	finish(1, okResult(taskToken(tasksB())))
	local done = viewText(st)
	T.assert(has(done, "Task Gamma"), "new selection tasks render")
end

do
	local st, boardIdx = loadBoard()
	local taskIdx = openDetails(st, boardIdx)
	T.key(st, "escape")
	finish(1, okResult(taskToken(tasksA())))
	local txt = viewText(st)
	T.assert(not has(txt, "Task Alpha"), "late task completion ignored after close")
	T.assert(has(txt, "change-one"), "board rows intact after close")
end

do
	local st, boardIdx = freshInit()
	T.key(st, "r")
	T.eq(#T.requests(), boardIdx, "refresh during loading creates no second request")
	finish(1, okResult(boardToken(validBoard())))
	T.assert(has(viewText(st), "Sprint One"), "board renders after loading")
end

do
	local st, boardIdx = freshInit()
	T.key(st, "a")
	T.eq(#T.requests(), boardIdx, "archive toggle during loading queues no immediate request")
	finish(1, okResult(boardToken(validBoard())))
	local followIdx = boardIdx + 1
	T.eq(#T.requests(), followIdx, "exactly one follow-up board request")
	local argv = T.requests()[followIdx].argv
	T.eq(#argv, 7, "archived board argv length")
	T.eq(argv[1], "spego", "archived argv[1]")
	T.eq(argv[2], "--json", "archived argv[2]")
	T.eq(argv[3], "board", "archived argv[3]")
	T.eq(argv[4], "--fresh", "archived argv[4]")
	T.eq(argv[5], "--archived", "archived argv[5]")
	T.eq(argv[6], "--cwd", "archived argv cwd flag")
	T.eq(argv[7], "/repo", "archived argv cwd")
end
