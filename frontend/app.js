const API_BASE = "http://localhost:5000";
const todoForm = document.getElementById("todo-form");
const todoInput = document.getElementById("todo-input");
const todoList = document.getElementById("todo-list");
const todoCount = document.getElementById("todo-count");
const statusEl = document.getElementById("status");

let todos = [];

function setStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function clearStatus() {
  statusEl.textContent = "";
  statusEl.className = "status";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toBoolean(value) {
  return value === true || value === 1 || value === "true" || value === "1" || value === "yes";
}

function normalizeTodo(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const id = item.id ?? item.todo_id ?? item._id ?? item.uuid;
  const title = item.title ?? item.task ?? item.text ?? item.name ?? "";
  const completed = toBoolean(item.completed ?? item.done ?? item.isComplete ?? item.is_complete ?? item.finished);

  return {
    id: String(id),
    title: String(title),
    completed,
  };
}

function normalizeTodos(payload) {
  if (Array.isArray(payload)) {
    return payload.map(normalizeTodo).filter(Boolean);
  }

  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.todos)) {
      return payload.todos.map(normalizeTodo).filter(Boolean);
    }
    if (Array.isArray(payload.items)) {
      return payload.items.map(normalizeTodo).filter(Boolean);
    }
    if (payload.todo) {
      const normalized = normalizeTodo(payload.todo);
      return normalized ? [normalized] : [];
    }
  }

  return [];
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  let payload = null;
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else if (response.status !== 204) {
    payload = await response.text();
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && (payload.error || payload.message)
        ? payload.error || payload.message
        : typeof payload === "string" && payload.trim()
        ? payload
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

async function tryRequest(methods, paths, body, { id = null } = {}) {
  let lastError = new Error("Unable to reach the API.");

  for (const method of methods) {
    for (const path of paths) {
      const url = id ? `${API_BASE}${path}/${id}` : `${API_BASE}${path}`;
      const options = {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      };

      if (body !== undefined && method !== "GET" && method !== "DELETE") {
        options.body = JSON.stringify(body);
      }

      try {
        return await fetchJson(url, options);
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError;
}

async function loadTodos() {
  setStatus("Loading todos...", "info");

  try {
    const payload = await tryRequest(["GET"], ["/todos", "/api/todos", "/tasks", "/api/tasks"]);
    todos = normalizeTodos(payload);
    renderTodos();
    clearStatus();
  } catch (error) {
    setStatus(error.message || "Unable to load todos.", "error");
  }
}

async function addTodo(title) {
  const trimmed = title.trim();
  if (!trimmed) {
    return;
  }

  try {
    const payload = await tryRequest(
      ["POST"],
      ["/todos", "/api/todos", "/tasks", "/api/tasks"],
      { title: trimmed, completed: false, task: trimmed }
    );

    const nextTodos = normalizeTodos(payload);
    todos = nextTodos.length ? nextTodos : todos.concat({ id: crypto.randomUUID(), title: trimmed, completed: false });
    renderTodos();
    todoInput.value = "";
    setStatus("Todo added.", "success");
  } catch (error) {
    setStatus(error.message || "Unable to add todo.", "error");
  }
}

async function toggleTodo(todo) {
  try {
    const payload = await tryRequest(
      ["PATCH", "PUT", "POST"],
      ["/todos", "/api/todos", "/tasks", "/api/tasks"],
      { completed: !todo.completed },
      { id: todo.id }
    );

    const updatedTodo = normalizeTodo(payload);
    todos = todos.map((item) => {
      if (item.id !== todo.id) {
        return item;
      }

      return updatedTodo || { ...item, completed: !item.completed };
    });

    renderTodos();
    setStatus("Todo updated.", "success");
  } catch (error) {
    setStatus(error.message || "Unable to update todo.", "error");
  }
}

async function deleteTodo(todo) {
  try {
    await tryRequest(
      ["DELETE", "POST"],
      ["/todos", "/api/todos", "/tasks", "/api/tasks"],
      undefined,
      { id: todo.id }
    );

    todos = todos.filter((item) => item.id !== todo.id);
    renderTodos();
    setStatus("Todo deleted.", "success");
  } catch (error) {
    setStatus(error.message || "Unable to delete todo.", "error");
  }
}

function renderTodos() {
  todoCount.textContent = `${todos.length} task${todos.length === 1 ? "" : "s"}`;

  if (!todos.length) {
    todoList.innerHTML = '<li class="empty-state">No todos yet. Add one above.</li>';
    return;
  }

  todoList.innerHTML = todos
    .map(
      (todo) => `
        <li class="todo-item ${todo.completed ? "completed" : ""}">
          <label class="todo-label">
            <input type="checkbox" class="todo-checkbox" ${todo.completed ? "checked" : ""} data-id="${todo.id}" />
            <span>${escapeHtml(todo.title)}</span>
          </label>
          <button type="button" class="delete-btn" data-id="${todo.id}" aria-label="Delete ${escapeHtml(todo.title)}">Delete</button>
        </li>
      `
    )
    .join("");
}

todoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addTodo(todoInput.value);
});

todoList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest(".delete-btn");
  if (deleteButton) {
    const todo = todos.find((item) => item.id === deleteButton.dataset.id);
    if (todo) {
      deleteTodo(todo);
    }
    return;
  }

  const checkbox = event.target.closest(".todo-checkbox");
  if (checkbox) {
    const todo = todos.find((item) => item.id === checkbox.dataset.id);
    if (todo) {
      toggleTodo(todo);
    }
  }
});

window.addEventListener("DOMContentLoaded", loadTodos);
