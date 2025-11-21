// File: src/utils/pdfGenerator.ts
import { jsPDF } from "jspdf";

export interface CoverLetterPdfOptions {
    candidateName?: string;
    jobTitle?: string;
    sourceUrl?: string;
}

export interface CoverLetterPdfPayload {
    url: string;
    filename: string;
    blob: Blob;
}

const sanitizeFilePart = (value?: string) => {
    if (!value) return "";
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
};

const buildFileName = (options: CoverLetterPdfOptions): string => {
    const namePart = sanitizeFilePart(options.candidateName) || "candidate";
    const jobPart = sanitizeFilePart(options.jobTitle);
    const parts = [namePart, jobPart, "cover-letter"].filter(Boolean);
    return `${parts.join("-")}.pdf`;
};

export const createCoverLetterPdf = (
    letter: string,
    options: CoverLetterPdfOptions = {}
): CoverLetterPdfPayload => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 48;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    const lineHeight = 16;
    let cursorY = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Cover Letter", margin, cursorY);
    cursorY += lineHeight;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const metaLines: string[] = [];
    if (options.candidateName) metaLines.push(options.candidateName);
    if (options.jobTitle) metaLines.push(`Role: ${options.jobTitle}`);
    if (options.sourceUrl) metaLines.push(options.sourceUrl);

    if (metaLines.length) {
        metaLines.forEach(line => {
            doc.text(line, margin, cursorY);
            cursorY += lineHeight - 2;
        });
        cursorY += 8;
    }

    const paragraphs = letter
        .trim()
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(Boolean);

    const addParagraph = (text: string) => {
        const lines = doc.splitTextToSize(text.replace(/\s+/g, " "), contentWidth) as string[];
        lines.forEach((line: string) => {
            if (cursorY > pageHeight - margin) {
                doc.addPage();
                cursorY = margin;
            }
            doc.text(line, margin, cursorY);
            cursorY += lineHeight;
        });
        cursorY += lineHeight * 0.35;
    };

    paragraphs.forEach(addParagraph);

    const filename = buildFileName(options);
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);

    return { url, filename, blob };
};

export const triggerPdfDownload = (payload: CoverLetterPdfPayload) => {
    const link = document.createElement("a");
    link.href = payload.url;
    link.download = payload.filename;
    link.rel = "noopener";
    link.click();
};
