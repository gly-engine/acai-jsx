local M = {}

function M.createBus()
    local listeners = {}

    local function emit(...)
        for cb in pairs(listeners) do
            cb(...)
        end
    end

    local function on(cb)
        listeners[cb] = true
    end

    local function off(cb)
        listeners[cb] = nil
    end

    local function offAll()
        listeners = {}
    end

    return emit, on, off, offAll
end

return M
