import os

from flask import Flask, send_from_directory

ROOT = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)


@app.route("/")
def index():
    return send_from_directory(ROOT, "index.html")


@app.route("/styles.css")
def styles():
    return send_from_directory(ROOT, "styles.css", mimetype="text/css")


@app.route("/script.js")
def script():
    return send_from_directory(ROOT, "script.js", mimetype="application/javascript")


@app.route("/assests/<path:name>")
def assests(name):
    return send_from_directory(os.path.join(ROOT, "assests"), name)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5005)), debug=False)
