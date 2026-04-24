import json
from pathlib import Path


ROOT = Path(r"E:\CodeX\Neko-study\item_bank\out")
IMPORT_PREFIX = "导入"
READABLE_PREFIX = "可阅读"
CHOICE_TYPES = {"single_choice", "multiple_choice"}


def get_option_entries(question: dict) -> list[dict]:
    entries = []
    for index, option in enumerate(question.get("options", []) or []):
        label = chr(65 + index)
        text = ""
        if isinstance(option, dict):
            label = str(option.get("label") or label).strip().upper()
            text = str(option.get("text") or "").strip()
        else:
            text = str(option or "").strip()
        entries.append({"label": label, "text": text})
    return entries


def format_answer_text(question: dict) -> str:
    answer = question.get("answer")
    if isinstance(answer, list):
        return "、".join(str(item).strip().upper() for item in answer if str(item).strip())
    return str(answer if answer is not None else "").strip()


def render_readable_text(questions: list[dict]) -> str:
    lines = []

    for index, question in enumerate(questions, start=1):
        lines.append(f"{index}.{question.get('stem', '')}")

        if question.get("type") in CHOICE_TYPES:
            for entry in get_option_entries(question):
                lines.append(f"{entry['label']}.{entry['text']}")

        lines.append(f"答案：{format_answer_text(question)}")

        analysis = str(question.get("analysis") or "").strip()
        if analysis:
            lines.append(f"解析：{analysis}")

        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def main() -> None:
    import_files = sorted(ROOT.glob(f"{IMPORT_PREFIX}*.json"))
    updated_files = 0
    cleared_questions = 0

    for json_path in import_files:
        questions = json.loads(json_path.read_text(encoding="utf-8"))
        changed = False

        for question in questions:
            if question.get("type") not in CHOICE_TYPES:
                continue
            if not str(question.get("analysis") or "").strip():
                continue
            question["analysis"] = ""
            cleared_questions += 1
            changed = True

        if changed:
            json_path.write_text(
                json.dumps(questions, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            updated_files += 1

        readable_name = json_path.name.replace(IMPORT_PREFIX, READABLE_PREFIX, 1)
        readable_path = json_path.with_name(readable_name).with_suffix(".txt")
        readable_path.write_text(render_readable_text(questions), encoding="utf-8")

    print(f"UPDATED_FILES={updated_files}")
    print(f"CLEARED_QUESTIONS={cleared_questions}")


if __name__ == "__main__":
    main()
