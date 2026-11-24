from copy import deepcopy
from threading import Lock
from uuid import uuid4

from flask import Flask, jsonify, render_template, request
from openai import APIError

from game import HEROES, SCENES, new_game
from master import master

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16000
games = {}


def view(s):
    return dict(s, place=SCENES[s["scene"]][0])


@app.get("/")
def home():
    return render_template("game.html", heroes=HEROES)


@app.post("/games")
def start():
    try:
        s = new_game(request.json["heroes"])
    except (KeyError, TypeError, ValueError):
        return jsonify(error="Выбери от одного до трёх героев."), 400
    token = uuid4().hex
    games[token] = (s, Lock())
    return jsonify(id=token, game=view(s))


@app.route("/games/<token>", methods=["GET","POST"])
def play(token):
    entry = games.get(token)
    if entry is None:
        return jsonify(error="Эта партия уже завершена на сервере. Начни новую."), 404
    original, lock = entry
    with lock:
        if request.method == "GET":
            return jsonify(game=view(original))
        q = request.json
        if q.get("turn") != original["turn"] or original["ending"]:
            return jsonify(error="Ход уже завершён.",game=view(original)), 409
        text = q.get("action")
        hero = q.get("hero")
        if not isinstance(text,str) or not 1 <= len(text.strip()) <= 600 or not original["hp"].get(hero,0):
            return jsonify(error="Выбери героя в сознании и опиши действие до 600 знаков."), 400
        draft = deepcopy(original)
        try:
            turn = master.invoke(dict(game=draft, hero=hero, action=text.strip()))
        except (APIError, ValueError, KeyError, TypeError) as exc:
            app.logger.warning("Сбой хода: %s", type(exc).__name__)
            return jsonify(error="Мастер не смог завершить ход. Проверь подключение и настройки модели, затем повтори."), 503
        draft = turn["game"]
        draft["history"].extend([[hero,text.strip()],["Мастер",turn["answer"]]])
        draft["turn"] += 1
        original.update(draft)
        return jsonify(game=view(original))


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=18743, threaded=True)
