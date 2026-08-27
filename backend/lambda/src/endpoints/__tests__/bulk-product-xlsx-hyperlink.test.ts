import ExcelJS from 'exceljs';
import { cellValueToDisplayString } from '../../endpoints/bulk-product-xlsx';

describe('cellValueToDisplayString hyperlink preference', () => {
  it('prefers http(s) hyperlink over Click here text', () => {
    const v: ExcelJS.CellHyperlinkValue = {
      text: 'Click here',
      hyperlink: 'https://drive.google.com/drive/folders/1CLclvFUacvuzKF5N5WH8fjBTR6MwWH5o',
    };
    expect(cellValueToDisplayString(v)).toBe(
      'https://drive.google.com/drive/folders/1CLclvFUacvuzKF5N5WH8fjBTR6MwWH5o',
    );
  });

  it('prefers hyperlink when text is richText', () => {
    const v = {
      text: {
        richText: [{ text: 'https://drive.google.com/drive/folders/1ABC ' }],
      },
      hyperlink: 'https://drive.google.com/drive/folders/1CLclvFUacvuzKF5N5WH8fjBTR6MwWH5o',
    } as unknown as ExcelJS.CellValue;
    expect(cellValueToDisplayString(v)).toBe(
      'https://drive.google.com/drive/folders/1CLclvFUacvuzKF5N5WH8fjBTR6MwWH5o',
    );
  });

  it('falls back to text when hyperlink is not http(s)', () => {
    const v: ExcelJS.CellHyperlinkValue = {
      text: 'https://cdn.example/photo.jpg',
      hyperlink: 'mailto:x@y.com',
    };
    expect(cellValueToDisplayString(v)).toBe('https://cdn.example/photo.jpg');
  });
});
