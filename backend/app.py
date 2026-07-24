import os
import sqlite3
from flask import Flask, jsonify, request, g, current_app
from flask_cors import CORS


DATABASE = os.environ.get("TODO_DATABASE", os.path.join(os.path.dirname(__file__), "todos.db"))


def get_db():
    if "db" not in g:
        conn = sqlite3.connect(current_app.config["DATABASE"])
        conn.row_factory = sqlite3.Row
        g.db = conn
    return g.db


def close_db(exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db(database_path):
    db = sqlite3.connect(database_path)
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    db.commit()
    db.close()


def create_app(test_config=None):
    app = Flask(__name__)
    CORS(app)

    app.config.from_mapping(
        DATABASE=DATABASE,
        TESTING=False,
    )

    if test_config:
        app.config.update(test_config)

    app.config["DATABASE"] = app.config.get("DATABASE") or DATABASE

    @app.teardown_appcontext
    def teardown_db(exc):
        close_db(exc)

    @app.before_request
    def before_request():
        if "db" not in g:
            conn = sqlite3.connect(app.config["DATABASE"])
            conn.row_factory = sqlite3.Row
            g.db = conn

    @app.after_request
    def after_request(response):
        db = getattr(g, "db", None)
        if db is not None:
            db.commit()
            db.close()
            g.pop("db", None)
        return response

    @app.route("/todos", methods=["GET"])
    def list_todos():
        rows = g.db.execute("SELECT id, title, completed FROM todos ORDER BY id").fetchall()
        todos = [{"id": row["id"], "title": row["title"], "completed": bool(row["completed"])} for row in rows]
        return jsonify({"data": todos, "error": None})

    @app.route("/todos", methods=["POST"])
    def create_todo():
        data = request.get_json(silent=True) or {}
        title = data.get("title")
        completed = data.get("completed", False)

        if not isinstance(title, str) or not title.strip():
            return jsonify({"data": None, "error": "Title is required"}), 400
        if not isinstance(completed, bool):
            return jsonify({"data": None, "error": "completed must be a boolean"}), 400

        cursor = g.db.execute(
            "INSERT INTO todos (title, completed) VALUES (?, ?)",
            (title.strip(), int(completed)),
        )
        g.db.commit()
        todo_id = cursor.lastrowid
        row = g.db.execute("SELECT id, title, completed FROM todos WHERE id = ?", (todo_id,)).fetchone()
        return jsonify({"data": {"id": row["id"], "title": row["title"], "completed": bool(row["completed"])}, "error": None}), 201

    @app.route("/todos/<int:todo_id>", methods=["PUT"])
    def update_todo(todo_id):
        data = request.get_json(silent=True) or {}
        title = data.get("title")
        completed = data.get("completed")

        if title is not None and (not isinstance(title, str) or not title.strip()):
            return jsonify({"data": None, "error": "Title is required"}), 400
        if completed is not None and not isinstance(completed, bool):
            return jsonify({"data": None, "error": "completed must be a boolean"}), 400

        existing = g.db.execute("SELECT id, title, completed FROM todos WHERE id = ?", (todo_id,)).fetchone()
        if existing is None:
            return jsonify({"data": None, "error": "Todo not found"}), 404

        if title is None:
            title = existing["title"]
        if completed is None:
            completed = bool(existing["completed"])

        g.db.execute(
            "UPDATE todos SET title = ?, completed = ? WHERE id = ?",
            (title.strip(), int(completed), todo_id),
        )
        g.db.commit()
        row = g.db.execute("SELECT id, title, completed FROM todos WHERE id = ?", (todo_id,)).fetchone()
        return jsonify({"data": {"id": row["id"], "title": row["title"], "completed": bool(row["completed"])}, "error": None})

    @app.route("/todos/<int:todo_id>", methods=["DELETE"])
    def delete_todo(todo_id):
        row = g.db.execute("SELECT id, title, completed FROM todos WHERE id = ?", (todo_id,)).fetchone()
        if row is None:
            return jsonify({"data": None, "error": "Todo not found"}), 404

        g.db.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
        g.db.commit()
        return jsonify({"data": {"id": row["id"], "title": row["title"], "completed": bool(row["completed"])}, "error": None})

    with app.app_context():
        init_db(app.config["DATABASE"])

    return app


app = create_app()
