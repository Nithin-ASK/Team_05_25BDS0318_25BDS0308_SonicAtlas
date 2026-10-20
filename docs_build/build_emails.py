"""Write the ready-to-send (NOT sent) email drafts."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import OUT, PREFIX, TITLE, links  # noqa: E402

L = links()
SIGN = """Regards,
Team 05
Sharvesh Prabhu (25BDS0318)
Nithin S (25BDS0308)
B.Tech, Vellore Institute of Technology, Vellore"""
LINKS = f"""GitHub repository: {L['github']}
Live website: {L['live']}"""


def mail(subject, body, files):
    att = "\n".join(f"  - {f}" for f in files)
    return f"""SUBJECT: {subject}
TO: <faculty email>
CC: <email> (Sharvesh Prabhu), nithin.s2025a@vitstudent.ac.in (Nithin S)

Respected Sir,

{body}

Attachments:
{att}

{LINKS}

{SIGN}
"""


drafts = [
    ("EMAIL 1 - Review-2 PPT",
     mail(f"{PREFIX} - Review-2 PPT - EDA Course Project",
          f"Greetings. As requested, please find attached the Review-2 presentation of Team 05 for the BACSE301 Exploratory "
          f"Data Analysis course project, titled \"{TITLE}\". The presentation has 10 slides and covers the recap, literature "
          "survey, architecture, completed preprocessing, descriptive statistics, correlation and multivariate results, first "
          "dimensionality-reduction results, module status and next steps.\n\nKindly review it and let us know if any changes are needed.",
          [f"{PREFIX}_Review2_PPT.pptx", f"{PREFIX}_Review2_PPT.pdf"])),
    ("EMAIL 2 - Review-3 PPT",
     mail(f"{PREFIX} - Review-3 PPT - EDA Course Project",
          "Greetings. Please find attached the Review-3 presentation of Team 05. It covers the completed implementation: "
          "time-series and decade trends, acoustic clusters, lyrics text mining, hypothesis tests, the SonicAtlas website, "
          "evaluation results and the project outcome.\n\nKindly review it at your convenience.",
          [f"{PREFIX}_Review3_PPT.pptx", f"{PREFIX}_Review3_PPT.pdf"])),
    ("EMAIL 3 - Final submission",
     mail(f"{PREFIX} - Final Report, Final PPT and Project Outcome - EDA Course Project",
          "Greetings. Please find attached the final submission of Team 05 for the BACSE301 course project: the project "
          "report (case study, Lab Assessment-7), the final presentation, the IEEE-format research paper (prepared for "
          "submission), the outcome proof document and our similarity self-check report. The complete source code is in "
          "the GitHub repository below and the website can be used directly in the browser.\n\nThank you for your guidance "
          "throughout the course.",
          [f"{PREFIX}_Project_Report.pdf", f"{PREFIX}_Project_Report.docx", f"{PREFIX}_Final_PPT.pptx",
           f"{PREFIX}_IEEE_Paper.pdf", f"{PREFIX}_Outcome_Proof.pdf", f"{PREFIX}_Plagiarism_Report.pdf"])),
]
text = "DRAFTS ONLY - NOT SENT. Replace <faculty email> and <email>, check the links, attach the files, then send.\n\n"
text += ("\n" + "=" * 70 + "\n").join(f"{t}\n{'-' * len(t)}\n{b}" for t, b in drafts)
(OUT / f"{PREFIX}_Email_Drafts.txt").write_text(text, encoding="utf-8")
print("ok")
