import type { ReactNode } from 'react';
import type { QuestionTableData } from '../src/utils/questionTable';

export default function QuestionTable({ table, renderCell }: {
  table: QuestionTableData;
  renderCell: (text: string) => ReactNode;
}) {
  return (
    <div className="my-2 overflow-x-auto">
      <table className="w-full table-fixed border-collapse text-left text-[0.95em] [overflow-wrap:anywhere]"
        style={{ minWidth: table.headers.length > 2 ? `${table.headers.length * 4.5}rem` : undefined }}>
        <thead className="bg-stone-50">
          <tr>{table.headers.map((cell, index) => (
            <th key={index} scope="col" className={`border border-stone-300 px-2.5 py-1.5 ${table.headers.length === 2 && index === 0 ? 'w-[28%]' : ''}`}>
              {renderCell(cell)}
            </th>
          ))}</tr>
        </thead>
        <tbody>{table.rows.map((row, index) => (
          <tr key={index}>{row.map((cell, column) => (
            <td key={column} className="border border-stone-300 px-2.5 py-1.5 align-top">{renderCell(cell)}</td>
          ))}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}
