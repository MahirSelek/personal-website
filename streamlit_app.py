import base64
import re
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

ROOT = Path(__file__).resolve().parent


def _build_inlined_html() -> str:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    js = (ROOT / "script.js").read_text(encoding="utf-8")
    png_path = ROOT / "assests" / "pp.png"
    data_uri = "data:image/png;base64," + base64.b64encode(png_path.read_bytes()).decode(
        "ascii"
    )

    html = re.sub(
        r'<link rel="stylesheet" href="\./styles\.css(?:\?v=\d+)?" />',
        f"<style>\n{css}\n</style>",
        html,
        count=1,
    )
    html = html.replace('src="./assests/pp.png"', f'src="{data_uri}"')
    html = re.sub(
        r'<script src="\./script\.js(?:\?v=\d+)?"></script>',
        f"<script>\n{js}\n</script>",
        html,
        count=1,
    )

    auto_resize_script = """
<script>
  (function () {
    function getDocHeight() {
      return Math.max(
        document.documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0,
        document.documentElement.offsetHeight,
        document.body ? document.body.offsetHeight : 0
      );
    }

    function applyHeight() {
      var frame = window.frameElement;
      if (!frame) return;
      frame.style.height = getDocHeight() + "px";
    }

    var scheduled = false;
    function scheduleHeightUpdate() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(function () {
        scheduled = false;
        applyHeight();
      });
    }

    window.addEventListener("load", scheduleHeightUpdate);
    window.addEventListener("resize", scheduleHeightUpdate);

    if (document.body) {
      new ResizeObserver(scheduleHeightUpdate).observe(document.body);
      new MutationObserver(scheduleHeightUpdate).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
      });
    }

    // Capture late async updates caused by JS UI interactions.
    setInterval(scheduleHeightUpdate, 300);
    scheduleHeightUpdate();
  })();
</script>
"""
    if "</body>" in html:
        html = html.replace("</body>", f"{auto_resize_script}\n</body>", 1)
    else:
        html += auto_resize_script
    return html


st.set_page_config(
    layout="wide",
    page_title="Mahir Selek | Data Scientist & AI Engineer",
    initial_sidebar_state="collapsed",
)

st.markdown(
    """
    <style>
      /* Make Streamlit host page behave like a full-bleed web container */
      [data-testid="stAppViewContainer"],
      [data-testid="stMain"] {
        background: #fdf6e3;
      }

      [data-testid="stMainBlockContainer"] {
        max-width: none;
        padding: 0;
      }

      /* Remove default iframe card feeling */
      .stIFrame {
        border: 0;
      }
    </style>
    """,
    unsafe_allow_html=True,
)

# Start with a safe viewport height, then auto-resize dynamically in iframe JS.
components.html(_build_inlined_html(), height=900, scrolling=False)
