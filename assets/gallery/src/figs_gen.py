"""The motion gallery has no backup figures."""
import os
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "figs.html"), "w", encoding="utf8").write("")
