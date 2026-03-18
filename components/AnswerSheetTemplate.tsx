import React, { useRef } from 'react';
import { Printer, ChevronLeft, Info } from 'lucide-react';

/**
 * AnswerSheetTemplate
 * ─────────────────────────────────────────────────────────────────────────────
 * Phiếu trả lời trắc nghiệm chuẩn in được.
 *
 * Đặc điểm nhận diện cho OpenCV:
 *  • 4 hình vuông đen (■) ở 4 góc → điểm neo cho Perspective Transform
 *  • 2 cột đáp án (A B C D), tổng N câu
 *  • Vùng điền tên học sinh, mã đề
 */

interface AnswerSheetTemplateProps {
  totalQuestions?: number;
  examTitle?: string;
  onBack: () => void;
}

const ANSWER_OPTIONS = ['A', 'B', 'C', 'D'];

const AnswerSheetTemplate: React.FC<AnswerSheetTemplateProps> = ({
  totalQuestions = 30,
  examTitle = 'PHIẾU TRẢ LỜI TRẮC NGHIỆM',
  onBack,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${examTitle}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; background: white; }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            @page { size: A4; margin: 0; }
          }
        </style>
      </head>
      <body>
        ${printContent.outerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const half = Math.ceil(totalQuestions / 2);
  const leftQuestions = Array.from({ length: half }, (_, i) => i + 1);
  const rightQuestions = Array.from({ length: totalQuestions - half }, (_, i) => i + half + 1);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0F0F0F', color: '#F5F5F5' }}>
      {/* Header ngoài (không in) */}
      <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-20 print:hidden"
        style={{ background: '#0F0F0F', borderBottom: '1px solid #1F1F1F' }}>
        <button onClick={onBack} className="p-2 rounded-lg" style={{ background: '#1A1A1A' }}>
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <h2 className="text-sm font-bold text-white">Phiếu Trả Lời Chuẩn</h2>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg, #6B7CDB, #5B6CC8)', color: '#fff' }}
        >
          <Printer className="w-4 h-4" />
          In phiếu
        </button>
      </div>

      {/* Hướng dẫn */}
      <div className="px-4 py-3 mx-4 mt-3 rounded-xl flex gap-3 print:hidden"
        style={{ background: '#1C1A11', border: '1px solid #3D3519' }}>
        <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#E8B800' }} />
        <div className="text-xs space-y-1" style={{ color: '#B8960C' }}>
          <p className="font-semibold" style={{ color: '#E8B800' }}>Hướng dẫn sử dụng phiếu này:</p>
          <p>① In phiếu trên giấy A4 (khổ đứng). ② Học sinh dùng bút chì hoặc bút bi tô đen ô đáp án chọn. ③ Thầy/cô dùng Camera trong mục "Chấm Điểm" để quét phiếu đã tô. ④ Giữ phiếu phẳng, đủ sáng khi chụp để đạt độ chính xác cao nhất.</p>
        </div>
      </div>

      {/* Preview phiếu in được */}
      <div className="flex-1 flex items-start justify-center p-4 overflow-auto">
        {/* Đây là nội dung sẽ được gửi đến máy in */}
        <div
          ref={printRef}
          style={{
            width: '210mm',
            minHeight: '297mm',
            background: 'white',
            color: 'black',
            fontFamily: 'Arial, sans-serif',
            fontSize: '11px',
            position: 'relative',
            padding: '0',
            boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
          }}
        >
          {/* ── 4 MARKER GÓC (điểm neo cho OpenCV) ── */}
          {/* Mỗi marker: hình vuông đen 12×12mm ở góc */}
          {[
            { top: '4mm', left: '4mm' },
            { top: '4mm', right: '4mm' },
            { bottom: '4mm', left: '4mm' },
            { bottom: '4mm', right: '4mm' },
          ].map((pos, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: '12mm',
                height: '12mm',
                background: '#000000',
                ...pos,
                zIndex: 10,
              }}
            />
          ))}

          {/* ── NỘI DUNG PHIẾU ── */}
          <div style={{ padding: '20mm 18mm 14mm 18mm' }}>

            {/* Tiêu đề */}
            <div style={{ textAlign: 'center', marginBottom: '6mm' }}>
              <div style={{ fontSize: '7px', letterSpacing: '2px', color: '#555', marginBottom: '2mm' }}>
                PHYSIVAULT • KHO LƯU TRỮ VẬT LÝ
              </div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '1px', color: '#000' }}>
                {examTitle}
              </div>
              <div style={{ fontSize: '9px', color: '#444', marginTop: '1mm' }}>
                Tổng số câu: {totalQuestions} câu ({half} câu/cột)
              </div>
            </div>

            {/* Thông tin học sinh */}
            <div style={{
              border: '1.5px solid #000',
              borderRadius: '3px',
              padding: '4mm 5mm',
              marginBottom: '6mm',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '3mm',
            }}>
              {[
                { label: 'Họ và tên:', wide: true },
                { label: 'Mã đề thi:', wide: false },
                { label: 'Lớp:', wide: false },
                { label: 'Ngày thi:', wide: false },
              ].map((field, i) => (
                <div key={i} style={{ gridColumn: field.label === 'Họ và tên:' ? 'span 2' : undefined }}>
                  <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#333' }}>{field.label} </span>
                  <span style={{
                    display: 'inline-block',
                    borderBottom: '1px solid #777',
                    minWidth: '60mm',
                    height: '4mm',
                    verticalAlign: 'bottom',
                  }} />
                </div>
              ))}
            </div>

            {/* Hướng dẫn nhỏ */}
            <div style={{
              background: '#F8F8F8',
              border: '1px solid #DDD',
              borderRadius: '2px',
              padding: '2mm 4mm',
              marginBottom: '5mm',
              fontSize: '8px',
              color: '#555',
            }}>
              <strong>Cách tô đáp án:</strong> Dùng bút chì/bút bi tô <strong>đen hoàn toàn</strong> ô chữ cái tương ứng.
              Ví dụ: <strong style={{ background: '#000', color: '#fff', padding: '0 2px' }}>A</strong>{' '}
              Nếu muốn đổi, tẩy sạch hoàn toàn rồi tô lại.
            </div>

            {/* ── GRID ĐÁP ÁN ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4mm' }}>
              {/* Cột trái */}
              <div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '20px 1fr 1fr 1fr 1fr',
                  gap: '0',
                  marginBottom: '1mm',
                }}>
                  <div style={{ fontSize: '7px', fontWeight: 'bold', color: '#888', textAlign: 'center' }}>#</div>
                  {ANSWER_OPTIONS.map(opt => (
                    <div key={opt} style={{ fontSize: '8px', fontWeight: 'bold', color: '#333', textAlign: 'center' }}>
                      {opt}
                    </div>
                  ))}
                </div>
                {leftQuestions.map(qNum => (
                  <div
                    key={qNum}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '20px 1fr 1fr 1fr 1fr',
                      borderBottom: '0.5px solid #E0E0E0',
                      alignItems: 'center',
                      height: '8.5mm',
                    }}
                  >
                    <div style={{ fontSize: '8px', fontWeight: '600', color: '#333', textAlign: 'right', paddingRight: '2mm' }}>
                      {qNum}
                    </div>
                    {ANSWER_OPTIONS.map(opt => (
                      <div
                        key={opt}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <div style={{
                          width: '6.5mm',
                          height: '6.5mm',
                          borderRadius: '50%',
                          border: '1.5px solid #000',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '7px',
                          fontWeight: 'bold',
                          color: '#555',
                        }}>
                          {opt}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Cột phải */}
              <div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '20px 1fr 1fr 1fr 1fr',
                  gap: '0',
                  marginBottom: '1mm',
                }}>
                  <div style={{ fontSize: '7px', fontWeight: 'bold', color: '#888', textAlign: 'center' }}>#</div>
                  {ANSWER_OPTIONS.map(opt => (
                    <div key={opt} style={{ fontSize: '8px', fontWeight: 'bold', color: '#333', textAlign: 'center' }}>
                      {opt}
                    </div>
                  ))}
                </div>
                {rightQuestions.map(qNum => (
                  <div
                    key={qNum}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '20px 1fr 1fr 1fr 1fr',
                      borderBottom: '0.5px solid #E0E0E0',
                      alignItems: 'center',
                      height: '8.5mm',
                    }}
                  >
                    <div style={{ fontSize: '8px', fontWeight: '600', color: '#333', textAlign: 'right', paddingRight: '2mm' }}>
                      {qNum}
                    </div>
                    {ANSWER_OPTIONS.map(opt => (
                      <div
                        key={opt}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <div style={{
                          width: '6.5mm',
                          height: '6.5mm',
                          borderRadius: '50%',
                          border: '1.5px solid #000',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '7px',
                          fontWeight: 'bold',
                          color: '#555',
                        }}>
                          {opt}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              marginTop: '8mm',
              paddingTop: '4mm',
              borderTop: '1px solid #DDD',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ fontSize: '7px', color: '#999' }}>
                PhysiVault · physivault.vercel.app
              </div>
              <div style={{ display: 'flex', gap: '2mm', alignItems: 'center' }}>
                <span style={{ fontSize: '7px', color: '#999' }}>Chữ ký giám thị:</span>
                <span style={{
                  display: 'inline-block',
                  width: '35mm',
                  borderBottom: '0.8px solid #999',
                  height: '6mm',
                }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnswerSheetTemplate;
