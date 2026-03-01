import { GradeData, GradeLevel } from './types';

export const CURRICULUM: GradeData[] = [
  {
    level: GradeLevel.Grade12,
    title: "Vật Lý 12",
    chapters: [
      { id: "12-1", name: "Chương 1: Vật lý nhiệt", description: "Nội năng, định luật 1 nhiệt động lực học, thang nhiệt độ." },
      { id: "12-2", name: "Chương 2: Khí lý tưởng", description: "Mô hình động học phân tử, phương trình trạng thái." },
      { id: "12-3", name: "Chương 3: Từ trường", description: "Lực từ, cảm ứng từ, hiện tượng cảm ứng điện từ." },
      { id: "12-4", name: "Chương 4: Vật lý hạt nhân", description: "Cấu tạo hạt nhân, phóng xạ, phản ứng hạt nhân." },
    ]
  },
  {
    level: GradeLevel.Grade11,
    title: "Vật Lý 11",
    chapters: [
      { id: "11-1", name: "Chương 1: Dao động", description: "Dao động điều hòa, con lắc lò xo, con lắc đơn." },
      { id: "11-2", name: "Chương 2: Sóng", description: "Sóng cơ, giao thoa sóng, sóng dừng." },
      { id: "11-3", name: "Chương 3: Điện trường", description: "Điện tích, định luật Coulomb, cường độ điện trường." },
      { id: "11-4", name: "Chương 4: Dòng điện và mạch điện", description: "Dòng điện không đổi, nguồn điện, điện năng." },
    ]
  },
  {
    level: GradeLevel.Grade10,
    title: "Vật Lý 10",
    chapters: [
      { id: "10-1", name: "Chương 1: Mở đầu", description: "Giới thiệu về vật lý, sai số trong phép đo." },
      { id: "10-2", name: "Chương 2: Mô tả chuyển động", description: "Các đại lượng đặc trưng của chuyển động." },
      { id: "10-3", name: "Chương 3: Chuyển động biến đổi", description: "Gia tốc, chuyển động thẳng biến đổi đều, rơi tự do." },
      { id: "10-4", name: "Chương 4: Ba định luật Newton. Một số lực trong thực tiễn", description: "Các định luật Newton, lực ma sát, lực cản." },
      { id: "10-5", name: "Chương 5: Moment lực. Điều kiện cân bằng", description: "Moment lực, quy tắc moment, ngẫu lực." },
      { id: "10-6", name: "Chương 6: Năng lượng, công, công suất", description: "Động năng, thế năng, định luật bảo toàn cơ năng." },
      { id: "10-7", name: "Chương 7: Động lượng", description: "Động lượng, xung lượng của lực, định luật bảo toàn động lượng." },
      { id: "10-8", name: "Chương 8: Chuyển động tròn", description: "Chuyển động tròn đều, lực hướng tâm." },
      { id: "10-9", name: "Chương 9: Biến dạng của vật rắn. Áp suất chất lỏng", description: "Biến dạng cơ, sức căng bề mặt, áp suất thủy tĩnh." },
    ]
  }
];
