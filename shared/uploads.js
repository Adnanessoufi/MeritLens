export const TEXT_EXTENSIONS = ['.txt', '.md', '.py', '.m', '.js', '.ts', '.java', '.c', '.cpp', '.html', '.css', '.csv']
export const UPLOAD_EXTENSIONS = ['.pdf', '.docx', '.ipynb', ...TEXT_EXTENSIONS]
export const UPLOAD_ACCEPT = UPLOAD_EXTENSIONS.join(',')
export const UPLOAD_LABEL = 'PDF, DOCX, text, code, CSV or notebooks'
