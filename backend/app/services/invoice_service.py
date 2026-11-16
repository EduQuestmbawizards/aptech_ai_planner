from datetime import date, datetime
from typing import List, Dict, Any


def _pdf_escape(text: str) -> str:
    """Escape special characters for PDF literal strings using latin-1 safe bytes."""
    clean = (text or "").replace("\r", " ").replace("\n", " ")
    clean = clean.encode("latin-1", "replace").decode("latin-1")
    return clean.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _wrap_text(text: str, max_chars: int = 75) -> List[str]:
    words = (text or "").split()
    if not words:
        return [""]
    lines: List[str] = []
    current = words[0]
    for word in words[1:]:
        if len(current) + 1 + len(word) <= max_chars:
            current += " " + word
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


class InvoiceService:
    @staticmethod
    def build_invoice_number(enrollment_id: str, enrolled_date: Any) -> str:
        if isinstance(enrolled_date, (date, datetime)):
            ym = enrolled_date.strftime("%Y%m")
        else:
            ym = date.today().strftime("%Y%m")
        short_id = (enrollment_id or "000000").replace("-", "")[:6].upper()
        return f"APT-INV-{ym}-{short_id}"

    @staticmethod
    def generate_invoice_pdf(invoice_data: Dict[str, Any]) -> bytes:
        """Generate a clean, spec-compliant A4 PDF invoice without external PDF dependencies."""
        ops: List[str] = []

        def add_rect(x: float, y: float, w: float, h: float, r: float, g: float, b: float, stroke: bool = False):
            if stroke:
                ops.append(f"{r:.3f} {g:.3f} {b:.3f} RG {x:.1f} {y:.1f} {w:.1f} {h:.1f} re S")
            else:
                ops.append(f"{r:.3f} {g:.3f} {b:.3f} rg {x:.1f} {y:.1f} {w:.1f} {h:.1f} re f")

        def add_line(x1: float, y1: float, x2: float, y2: float, r: float, g: float, b: float, width: float = 1.0):
            ops.append(f"{width:.2f} w {r:.3f} {g:.3f} {b:.3f} RG {x1:.1f} {y1:.1f} m {x2:.1f} {y2:.1f} l S")

        def add_text(x: float, y: float, text: str, size: int = 10, bold: bool = False, r: float = 0.08, g: float = 0.10, b: float = 0.14):
            font = "/F2" if bold else "/F1"
            escaped = _pdf_escape(str(text))
            ops.append(f"BT {font} {size} Tf {r:.3f} {g:.3f} {b:.3f} rg {x:.1f} {y:.1f} Td ({escaped}) Tj ET")

        # 1. Dark Obsidian Header Banner
        add_rect(0, 742, 595, 100, 0.06, 0.07, 0.09)
        add_rect(0, 738, 595, 4, 0.96, 0.62, 0.04)  # Gold accent bar

        add_text(40, 796, "APTECH LEARNING", size=20, bold=True, r=0.99, g=0.80, b=0.22)
        add_text(40, 777, "AI Career & Study Planner - Official Enrollment Invoice", size=10, bold=False, r=0.92, g=0.94, b=0.96)
        add_text(40, 761, "Unleash Your Potential", size=9, bold=True, r=0.98, g=0.75, b=0.14)

        add_text(420, 796, "ENROLLMENT INVOICE", size=12, bold=True, r=1.0, g=1.0, b=1.0)
        add_text(420, 778, f"No: {invoice_data['invoice_number']}", size=9, bold=True, r=0.99, g=0.83, b=0.30)
        add_text(420, 763, f"Status: {invoice_data['status']}", size=9, bold=False, r=0.52, g=0.94, b=0.67)

        # 2. Student & Invoice Metadata Boxes
        add_rect(40, 610, 250, 108, 0.99, 0.98, 0.94)
        add_rect(40, 610, 250, 108, 0.96, 0.85, 0.55, stroke=True)
        add_text(52, 700, "BILLED TO (STUDENT)", size=9, bold=True, r=0.71, g=0.33, b=0.04)
        add_text(52, 682, invoice_data.get("student_name", "Student"), size=11, bold=True)
        add_text(52, 665, f"Aptech ID: {invoice_data.get('aptech_student_id', 'N/A')}", size=9)
        add_text(52, 650, f"Email: {invoice_data.get('student_email', 'N/A')}", size=9)
        add_text(52, 635, f"Phone: {invoice_data.get('phone') or 'Not Provided'}", size=9)
        add_text(52, 620, f"Student Record: {invoice_data.get('enrollment_id', '')[:12]}", size=8, r=0.40, g=0.45, b=0.52)

        add_rect(305, 610, 250, 108, 0.97, 0.98, 0.99)
        add_rect(305, 610, 250, 108, 0.85, 0.88, 0.92, stroke=True)
        add_text(317, 700, "INVOICE & ADMISSION SUMMARY", size=9, bold=True, r=0.71, g=0.33, b=0.04)
        add_text(317, 682, f"Invoice Number: {invoice_data['invoice_number']}", size=9, bold=True)
        add_text(317, 665, f"Enrolled Date: {invoice_data.get('enrolled_date', 'N/A')}", size=9)
        add_text(317, 650, f"Valid Until: {invoice_data.get('valid_until') or 'Course Completion'}", size=9)
        add_text(317, 635, f"Payment Ref: {invoice_data.get('payment_reference') or 'Verified at Center'}", size=9, bold=True)
        add_text(317, 620, f"Enrollment Status: {invoice_data.get('status', 'ACTIVE')}", size=9, r=0.06, g=0.45, b=0.25)

        # 3. Course Details Section
        add_text(40, 582, "COURSE & CURRICULUM DETAILS", size=10, bold=True, r=0.08, g=0.10, b=0.14)
        add_line(40, 576, 555, 576, 0.96, 0.62, 0.04, width=1.5)

        add_rect(40, 492, 515, 76, 0.98, 0.98, 0.99)
        add_rect(40, 492, 515, 76, 0.88, 0.90, 0.94, stroke=True)

        course_name_lines = _wrap_text(invoice_data.get("course_name", "Aptech Course"), max_chars=74)
        add_text(52, 550, f"[{invoice_data.get('course_code', '')}] {course_name_lines[0]}", size=11, bold=True)
        if len(course_name_lines) > 1:
            add_text(52, 535, course_name_lines[1], size=10, bold=True)

        y_meta = 516 if len(course_name_lines) > 1 else 528
        add_text(52, y_meta, f"Category: {invoice_data.get('category') or 'Career Track'}", size=9)
        add_text(245, y_meta, f"Duration: {invoice_data.get('official_duration_value')} {invoice_data.get('official_duration_unit')}", size=9)
        add_text(415, y_meta, f"Total Hours: {invoice_data.get('total_learning_hours')} hrs", size=9, bold=True, r=0.71, g=0.33, b=0.04)

        add_text(
            52,
            500,
            f"Syllabus Version: {invoice_data.get('syllabus_version', 'v1.0')}  |  Difficulty: {invoice_data.get('difficulty_level', 'INTERMEDIATE')}  |  Modules: {invoice_data.get('modules_count', 0)}  |  Topics: {invoice_data.get('topics_count', 0)}",
            size=8,
            r=0.35,
            g=0.40,
            b=0.47,
        )

        # 4. Curriculum Modules Table
        y = 466
        add_text(40, y, "INCLUDED CURRICULUM MODULES", size=10, bold=True)
        y -= 18
        add_rect(40, y - 4, 515, 20, 0.06, 0.07, 0.09)
        add_text(50, y + 2, "CODE", size=8, bold=True, r=0.99, g=0.80, b=0.22)
        add_text(130, y + 2, "MODULE TITLE", size=8, bold=True, r=0.99, g=0.80, b=0.22)
        add_text(425, y + 2, "TOPICS", size=8, bold=True, r=0.99, g=0.80, b=0.22)
        add_text(490, y + 2, "HOURS", size=8, bold=True, r=0.99, g=0.80, b=0.22)
        y -= 20

        modules: List[Dict[str, Any]] = invoice_data.get("modules_summary") or []
        if not modules:
            add_text(50, y, "Standard Aptech curriculum syllabus modules included.", size=9, r=0.40, g=0.45, b=0.52)
            y -= 20
        else:
            for idx, m in enumerate(modules[:12]):
                if y < 120:
                    break
                if idx % 2 == 0:
                    add_rect(40, y - 5, 515, 19, 0.97, 0.97, 0.98)
                add_text(50, y, str(m.get("module_code", ""))[:12], size=8, bold=True)
                title_str = str(m.get("title", ""))
                if len(title_str) > 52:
                    title_str = title_str[:49] + "..."
                add_text(130, y, title_str, size=9)
                add_text(435, y, str(m.get("topics_count", 0)), size=9)
                add_text(490, y, f"{m.get('estimated_hours', 0)} hrs", size=9, bold=True)
                y -= 20

        # 5. Notes & Verification Footer
        notes = invoice_data.get("notes")
        if notes and y > 130:
            y -= 10
            add_text(40, y, "ADMISSION / PAYMENT NOTES", size=9, bold=True, r=0.40, g=0.45, b=0.52)
            y -= 14
            for line in _wrap_text(str(notes), max_chars=88)[:3]:
                add_text(40, y, line, size=8, r=0.35, g=0.40, b=0.47)
                y -= 12

        add_line(40, 82, 555, 82, 0.85, 0.88, 0.92, width=0.8)
        add_text(
            40,
            64,
            "This is a digitally generated enrollment invoice from Aptech Learning AI Career & Study Planner.",
            size=8,
            r=0.40,
            g=0.45,
            b=0.52,
        )
        add_text(
            40,
            50,
            f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M')}  |  Verified Enrollment Record: {invoice_data.get('enrollment_id', '')}",
            size=8,
            r=0.50,
            g=0.55,
            b=0.62,
        )

        # Assemble valid PDF 1.4 binary
        stream_bytes = "\n".join(ops).encode("latin-1", "replace")
        objects: List[bytes] = [
            b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
            b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
            b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n",
            b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
            b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
            (
                f"6 0 obj\n<< /Length {len(stream_bytes)} >>\nstream\n".encode("ascii")
                + stream_bytes
                + b"\nendstream\nendobj\n"
            ),
        ]

        header = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
        body = bytearray(header)
        offsets: List[int] = [0]

        for obj in objects:
            offsets.append(len(body))
            body.extend(obj)

        xref_start = len(body)
        xref_lines = [f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("ascii")]
        for off in offsets[1:]:
            xref_lines.append(f"{off:010d} 00000 n \n".encode("ascii"))

        trailer = (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_start}\n%%EOF\n"
        ).encode("ascii")

        body.extend(b"".join(xref_lines))
        body.extend(trailer)
        return bytes(body)

