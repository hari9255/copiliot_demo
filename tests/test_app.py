import pytest

from backend.app import create_app


@pytest.fixture
def client(tmp_path):
    db_path = tmp_path / "todos.db"
    app = create_app({"TESTING": True, "DATABASE": str(db_path)})
    with app.test_client() as client:
        yield client


def test_get_todos_returns_empty_list(client):
    response = client.get("/todos")

    assert response.status_code == 200
    assert response.get_json() == {"data": [], "error": None}


def test_create_todo(client):
    response = client.post(
        "/todos",
        json={"title": "Buy milk", "completed": False},
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload["error"] is None
    assert payload["data"]["title"] == "Buy milk"
    assert payload["data"]["completed"] is False


def test_update_todo(client):
    created = client.post("/todos", json={"title": "Write report", "completed": False})
    todo_id = created.get_json()["data"]["id"]

    response = client.put(f"/todos/{todo_id}", json={"title": "Write report", "completed": True})

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["data"]["completed"] is True
    assert payload["data"]["title"] == "Write report"


def test_delete_todo(client):
    created = client.post("/todos", json={"title": "Clean desk", "completed": False})
    todo_id = created.get_json()["data"]["id"]

    response = client.delete(f"/todos/{todo_id}")

    assert response.status_code == 200
    assert response.get_json()["data"]["id"] == todo_id

    get_response = client.get("/todos")
    assert get_response.get_json()["data"] == []
