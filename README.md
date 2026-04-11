# Personal website – Mahir Selek

Static single-page website built with plain HTML, CSS and JavaScript in a neobrutalist style.

## Structure

- `index.html`: main page layout (hero, navigation cards, detail panel).
- `styles.css`: visual design and neobrutalist styling.
- `script.js`: logic for switching sections when you click the cards.

Profile photo: `assests/pp.png`.

## How to run locally

Open `index.html` directly in a browser, or serve the folder with any static web server (for example, with Python: `python -m http.server` in this directory).

**Flask:** `pip install -r requirements.txt` then `python app.py` and open `http://127.0.0.1:5000`.

**Streamlit (matches the same site):** `streamlit run streamlit_app.py`.

## Streamlit Community Cloud

Set **Main file path** to: `streamlit_app.py` (not `app.py`; Cloud runs Streamlit only). The Flask app is for hosts that run WSGI (e.g. Render, Railway) via `gunicorn app:app`.

## How to update content

- To change text (projects, experience, education, skills, contact), edit the `sections` object in `script.js`.
- To adjust layout or colours, edit `styles.css`.

