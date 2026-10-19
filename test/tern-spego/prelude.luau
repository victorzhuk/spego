-- Deterministic Tern boundary fixture for plugins/tern-spego/host.luau.
-- Concatenated before the verbatim host source and one scenario group.
--
-- T harness API (frozen; scenario files rely on these):
--   T.assert(cond, msg)          raise "FAIL: <msg>" when cond is falsy
--   T.eq(actual, expected, msg)  assert deep-free equality via == on values
--   T.finish()                   raise "FAIL: scenario group executed no assertion" when no assertion ran
--   T.reset()                    clear per-scenario state (block definition persists)
--   T.panes(list)                set pane id list returned by tern.pane.list()
--   T.json(token, value)         register decoded value for tern.json.decode(token)
--   T.jsonError(token, message)  make tern.json.decode(token) raise message
--   T.define()                   return the table given to tern.block.define
--   T.cx(cwd, cols)              build and remember the mock cx (cols default 80)
--   T.init(cwd, saved?)          run the block init hook; returns its state
--   T.view(state)                run the view hook; counts one render; returns view
--   T.key(state, name)           run the key hook with key.name = name
--   T.event(state, ev)           run the event hook with the given ev table
--   T.save(state)                run the save hook
--   T.title(state)               run the title hook
--   T.requests()                 list of recorded process requests
--   T.pending()                  count of process callbacks not yet completed
--   T.complete(index, result)    invoke recorded callback index (1-based)
--   T.failNextStart()            next tern.process.run raises "spawn failed"
--   T.renderCount()              number of cx:render() plus T.view() calls
--   T.text(nodeOrView)           flatten spans/text/children into one string
--   T.find(nodeOrView, key)      first node whose p.key == key
--   T.findRole(nodeOrView, role) first node whose p.role == role

local jsonValues: { [string]: any } = {}
local jsonErrors: { [string]: string } = {}
local paneIds: { number } = { 1 }
local requests: { { argv: any, cwd: any, timeout_ms: any } } = {}
local callbacks: { any } = {}
local failStart = false
local assertCount = 0
local renderCalls = 0
local blockDef: any = nil
local lastCx: any = nil

local function guarded(tbl: { [string]: any }, prefix: string): { [string]: any }
	return setmetatable(tbl, {
		__index = function(_: any, k: any)
			error("unknown tern api: " .. prefix .. tostring(k), 2)
		end,
	})
end

-- tern.json.null: unique sentinel table usable inside fixtures.
local NULL_SENTINEL = {}

local tern: any = {}

tern.block = guarded({
	define = function(_id: any, def: any)
		blockDef = def
	end,
}, "block.")

tern.process = guarded({
	run = function(argv: any, opts: any, cb: any): boolean
		if failStart then
			failStart = false
			error("spawn failed", 2)
		end
		local optsTbl: any = opts or {}
		table.insert(requests, {
			argv = argv,
			cwd = optsTbl.cwd,
			timeout_ms = optsTbl.timeout_ms,
		})
		table.insert(callbacks, cb)
		return true
	end,
}, "process.")

tern.json = guarded({
	decode = function(s: any): any
		local token = tostring(s)
		local errMsg = jsonErrors[token]
		if errMsg ~= nil then
			error(errMsg, 2)
		end
		local value = jsonValues[token]
		if value == nil then
			error("unexpected decode token: " .. token, 2)
		end
		return value
	end,
	null = NULL_SENTINEL,
}, "json.")

tern.pane = guarded({
	list = function(): { any }
		local list: { any } = {}
		for _, id in paneIds do
			table.insert(list, { pane = id })
		end
		return list
	end,
}, "pane.")

local function span(text: any, tone: any): any
	return { kind = "span", text = text, tone = tone, p = {} }
end

local function text(spans: any): any
	return { kind = "text", spans = spans, p = {} }
end

local function box(kind: string, children: any): any
	return { kind = kind, children = children, p = {} }
end

tern.ui = guarded({
	span = span,
	text = text,
	row = function(children: any): any
		return box("row", children)
	end,
	col = function(children: any): any
		return box("col", children)
	end,
	card = function(head: any, children: any): any
		return { kind = "card", spans = head, children = children, p = {} }
	end,
	section = function(head: any, children: any): any
		return { kind = "section", spans = head, children = children, p = {} }
	end,
	el = function(kind: any, props: any, children: any): any
		return { kind = kind, props = props, children = children, p = {} }
	end,
	node = function(kind: any, props: any): any
		return { kind = kind, props = props, children = {}, p = {} }
	end,
	table = function(cols: any, rows: any): any
		return { kind = "table", props = { cols = cols, rows = rows }, children = {}, p = {} }
	end,
}, "ui.")

tern = setmetatable(tern, {
	__index = function(_: any, k: any)
		error("unknown tern api: tern." .. tostring(k), 2)
	end,
})

local T: any = {}

T.assert = function(cond: any, msg: string)
	assertCount += 1
	if not cond then
		error("FAIL: " .. tostring(msg), 2)
	end
end

T.eq = function(actual: any, expected: any, msg: string)
	assertCount += 1
	if actual ~= expected then
		error(
			"FAIL: " .. tostring(msg) .. " (expected " .. tostring(expected) .. ", got " .. tostring(actual) .. ")",
			2
		)
	end
end

T.finish = function()
	if assertCount == 0 then
		error("FAIL: scenario group executed no assertion", 2)
	end
end

T.reset = function()
	jsonValues = {}
	jsonErrors = {}
	paneIds = { 1 }
	requests = {}
	callbacks = {}
	failStart = false
	renderCalls = 0
	lastCx = nil
	assertCount = 0
end

T.panes = function(list: any)
	paneIds = list or { 1 }
end

T.json = function(token: string, value: any)
	jsonValues[token] = value
end

T.jsonError = function(token: string, message: string)
	jsonErrors[token] = message
end

T.define = function(): any
	T.assert(blockDef ~= nil, "host never called tern.block.define")
	return blockDef
end

T.cx = function(cwd: any, cols: number?): any
	local cx: any = {
		pane = 1,
		cwd = cwd,
		cols = cols or 80,
		render = function(_: any)
			renderCalls += 1
		end,
	}
	lastCx = cx
	return cx
end

T.init = function(cwd: any, saved: any?): any
	local def = T.define()
	return def.init(T.cx(cwd), nil, saved)
end

T.view = function(state: any): any
	renderCalls += 1
	return T.define().view(state, lastCx or T.cx("/repo"))
end

T.key = function(state: any, name: string): any
	return T.define().key(state, { name = name }, lastCx)
end

T.event = function(state: any, ev: any): any
	return T.define().event(state, ev, lastCx)
end

T.save = function(state: any): any
	return T.define().save(state)
end

T.title = function(state: any): any
	return T.define().title(state)
end

T.requests = function(): { any }
	return requests
end

T.pending = function(): number
	return #callbacks
end

T.complete = function(index: number, result: any)
	T.assert(index >= 1 and index <= #callbacks, "no pending callback at index " .. tostring(index))
	local cb = callbacks[index]
	table.remove(callbacks, index)
	return cb(result)
end

T.failNextStart = function()
	failStart = true
end

T.renderCount = function(): number
	return renderCalls
end

local function flatten(node: any, out: { string })
	if type(node) ~= "table" then
		if node ~= nil then
			table.insert(out, tostring(node))
		end
		return
	end
	if node.main ~= nil then
		flatten(node.main, out)
		return
	end
	if node.text ~= nil then
		table.insert(out, tostring(node.text))
	end
	if node.spans ~= nil then
		for _, s in node.spans do
			flatten(s, out)
		end
	end
	if node.children ~= nil then
		for _, c in node.children do
			flatten(c, out)
		end
	end
end

T.text = function(nodeOrView: any): string
	local out: { string } = {}
	flatten(nodeOrView, out)
	return table.concat(out, " ")
end

local function search(node: any, pred: any): any
	if type(node) ~= "table" then
		return nil
	end
	local root = node
	if root.main ~= nil then
		root = root.main
	end
	if type(root.p) == "table" and pred(root.p) then
		return root
	end
	for _, key in ({ "spans", "children" } :: { string }) do
		local list = root[key]
		if type(list) == "table" then
			for _, child in list do
				local hit = search(child, pred)
				if hit ~= nil then
					return hit
				end
			end
		end
	end
	return nil
end

T.find = function(nodeOrView: any, key: string): any
	return search(nodeOrView, function(p: any)
		return p.key == key
	end)
end

T.findRole = function(nodeOrView: any, role: string): any
	return search(nodeOrView, function(p: any)
		return p.role == role
	end)
end
