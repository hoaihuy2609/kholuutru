import React, { useState, useMemo, useEffect } from 'react';
import {
  Folder, ChevronRight, ChevronDown,
  Search, Plus, Trash2, Layers, X, RotateCcw
} from 'lucide-react';
import { BlogPost } from '../types';

export interface TreeNode {
  id: string;
  name: string;
  level: 'grade' | 'chapter' | 'lesson' | 'topic';
  grade?: number; // 10, 11, 12
  parentId?: string;
  children?: TreeNode[];
  isCustom?: boolean;
}

export interface TreeSelection {
  type: 'all' | 'grade' | 'chapter' | 'lesson' | 'topic';
  id?: string;
  name?: string;
  grade?: number;
}

// ─────────────────────────────────────────────────────────────
// CÂY MỤC LỤC MẶC ĐỊNH CHUẨN GDPT 2018 (VẬT LÝ 10, 11, 12)
// Cố định Khối lớp và Tên chương theo SGK mới.
// Bài học & Dạng bài có sẵn khung mẫu chuẩn và cho phép người dùng tự thêm/sửa/xóa.
// ─────────────────────────────────────────────────────────────
export const INITIAL_PHYSICS_TREE: TreeNode[] = [
  {
    id: 'grade-10',
    name: 'VẬT LÝ 10',
    level: 'grade',
    grade: 10,
    children: [
      {
        id: 'g10-ch0',
        name: 'MỞ ĐẦU. GIỚI THIỆU MÔN VẬT LÍ',
        level: 'chapter',
        grade: 10,
        children: [
          {
            id: 'g10-ch0-l1',
            name: 'Bài 1. Khái quát về môn Vật lí & Sai số',
            level: 'lesson',
            grade: 10,
            children: [
              { id: 'g10-ch0-l1-t1', name: 'Dạng 1. Phương pháp nghiên cứu và an toàn', level: 'topic', grade: 10 },
              { id: 'g10-ch0-l1-t2', name: 'Dạng 2. Sai số trong phép đo vật lí', level: 'topic', grade: 10 }
            ]
          }
        ]
      },
      {
        id: 'g10-ch1',
        name: 'CHƯƠNG I. ĐỘNG HỌC',
        level: 'chapter',
        grade: 10,
        children: [
          {
            id: 'g10-ch1-l1',
            name: 'Bài 1. Mô tả chuyển động thẳng',
            level: 'lesson',
            grade: 10,
            children: [
              { id: 'g10-ch1-l1-t1', name: 'Dạng 1. Quãng đường và độ dịch chuyển', level: 'topic', grade: 10 },
              { id: 'g10-ch1-l1-t2', name: 'Dạng 2. Tốc độ và vận tốc', level: 'topic', grade: 10 },
              { id: 'g10-ch1-l1-t3', name: 'Dạng 3. Đồ thị độ dịch chuyển - thời gian', level: 'topic', grade: 10 }
            ]
          },
          {
            id: 'g10-ch1-l2',
            name: 'Bài 2. Chuyển động biến đổi',
            level: 'lesson',
            grade: 10,
            children: [
              { id: 'g10-ch1-l2-t1', name: 'Dạng 1. Gia tốc chuyển động thẳng biến đổi đều', level: 'topic', grade: 10 },
              { id: 'g10-ch1-l2-t2', name: 'Dạng 2. Phương trình và đồ thị vận tốc', level: 'topic', grade: 10 },
              { id: 'g10-ch1-l2-t3', name: 'Dạng 3. Rơi tự do và chuyển động ném', level: 'topic', grade: 10 }
            ]
          }
        ]
      },
      {
        id: 'g10-ch2',
        name: 'CHƯƠNG II. ĐỘNG LỰC HỌC',
        level: 'chapter',
        grade: 10,
        children: [
          {
            id: 'g10-ch2-l1',
            name: 'Bài 1. Ba định luật Newton',
            level: 'lesson',
            grade: 10,
            children: [
              { id: 'g10-ch2-l1-t1', name: 'Dạng 1. Tổng hợp và phân tích lực', level: 'topic', grade: 10 },
              { id: 'g10-ch2-l1-t2', name: 'Dạng 2. Áp dụng các định luật Newton', level: 'topic', grade: 10 }
            ]
          },
          {
            id: 'g10-ch2-l2',
            name: 'Bài 2. Các lực trong thực tế',
            level: 'lesson',
            grade: 10,
            children: [
              { id: 'g10-ch2-l2-t1', name: 'Dạng 1. Trọng lực và lực căng dây', level: 'topic', grade: 10 },
              { id: 'g10-ch2-l2-t2', name: 'Dạng 2. Lực ma sát và lực cản', level: 'topic', grade: 10 }
            ]
          }
        ]
      },
      {
        id: 'g10-ch3',
        name: 'CHƯƠNG III. NĂNG LƯỢNG, CÔNG, CÔNG SUẤT',
        level: 'chapter',
        grade: 10,
        children: [
          {
            id: 'g10-ch3-l1',
            name: 'Bài 1. Năng lượng và công cơ học',
            level: 'lesson',
            grade: 10,
            children: [
              { id: 'g10-ch3-l1-t1', name: 'Dạng 1. Tính công cơ học và công suất', level: 'topic', grade: 10 },
              { id: 'g10-ch3-l1-t2', name: 'Dạng 2. Động năng và định luật bảo toàn cơ năng', level: 'topic', grade: 10 }
            ]
          }
        ]
      },
      {
        id: 'g10-ch4',
        name: 'CHƯƠNG IV. ĐỘNG LƯỢNG VÀ VA CHẠM',
        level: 'chapter',
        grade: 10,
        children: []
      },
      {
        id: 'g10-ch5',
        name: 'CHƯƠNG V. CHUYỂN ĐỘNG TRÒN',
        level: 'chapter',
        grade: 10,
        children: []
      },
      {
        id: 'g10-ch6',
        name: 'CHƯƠNG VI. BIẾN DẠNG CỦA VẬT RẮN & ÁP SUẤT',
        level: 'chapter',
        grade: 10,
        children: []
      }
    ]
  },
  {
    id: 'grade-11',
    name: 'VẬT LÝ 11',
    level: 'grade',
    grade: 11,
    children: [
      {
        id: 'g11-ch1',
        name: 'CHƯƠNG I. DAO ĐỘNG',
        level: 'chapter',
        grade: 11,
        children: [
          {
            id: 'g11-ch1-l1',
            name: 'Bài 1. Mô tả dao động điều hòa',
            level: 'lesson',
            grade: 11,
            children: [
              { id: 'g11-ch1-l1-t1', name: 'Dạng 1. Phương trình li độ, vận tốc, gia tốc', level: 'topic', grade: 11 },
              { id: 'g11-ch1-l1-t2', name: 'Dạng 2. Đồ thị và mối liên hệ pha', level: 'topic', grade: 11 },
              { id: 'g11-ch1-l1-t3', name: 'Dạng 3. Năng lượng trong dao động điều hòa', level: 'topic', grade: 11 }
            ]
          },
          {
            id: 'g11-ch1-l2',
            name: 'Bài 2. Các loại dao động',
            level: 'lesson',
            grade: 11,
            children: [
              { id: 'g11-ch1-l2-t1', name: 'Dạng 1. Dao động tắt dần và cưỡng bức', level: 'topic', grade: 11 },
              { id: 'g11-ch1-l2-t2', name: 'Dạng 2. Hiện tượng cộng hưởng', level: 'topic', grade: 11 }
            ]
          }
        ]
      },
      {
        id: 'g11-ch2',
        name: 'CHƯƠNG II. SÓNG',
        level: 'chapter',
        grade: 11,
        children: [
          {
            id: 'g11-ch2-l1',
            name: 'Bài 1. Sóng cơ và sự truyền sóng',
            level: 'lesson',
            grade: 11,
            children: [
              { id: 'g11-ch2-l1-t1', name: 'Dạng 1. Phương trình sóng và bước sóng', level: 'topic', grade: 11 },
              { id: 'g11-ch2-l1-t2', name: 'Dạng 2. Giao thoa sóng cơ', level: 'topic', grade: 11 },
              { id: 'g11-ch2-l1-t3', name: 'Dạng 3. Sóng dừng trên dây', level: 'topic', grade: 11 }
            ]
          },
          {
            id: 'g11-ch2-l2',
            name: 'Bài 2. Sóng ánh sáng & Sóng điện từ',
            level: 'lesson',
            grade: 11,
            children: [
              { id: 'g11-ch2-l2-t1', name: 'Dạng 1. Tán sắc và giao thoa ánh sáng (Young)', level: 'topic', grade: 11 },
              { id: 'g11-ch2-l2-t2', name: 'Dạng 2. Thang sóng điện từ', level: 'topic', grade: 11 }
            ]
          }
        ]
      },
      {
        id: 'g11-ch3',
        name: 'CHƯƠNG III. ĐIỆN TRƯỜNG',
        level: 'chapter',
        grade: 11,
        children: [
          {
            id: 'g11-ch3-l1',
            name: 'Bài 1. Lực tĩnh điện & Cường độ điện trường',
            level: 'lesson',
            grade: 11,
            children: [
              { id: 'g11-ch3-l1-t1', name: 'Dạng 1. Định luật Coulomb', level: 'topic', grade: 11 },
              { id: 'g11-ch3-l1-t2', name: 'Dạng 2. Cường độ điện trường tổng hợp', level: 'topic', grade: 11 }
            ]
          },
          {
            id: 'g11-ch3-l2',
            name: 'Bài 2. Điện thế và Tụ điện',
            level: 'lesson',
            grade: 11,
            children: [
              { id: 'g11-ch3-l2-t1', name: 'Dạng 1. Công lực điện và thế năng', level: 'topic', grade: 11 },
              { id: 'g11-ch3-l2-t2', name: 'Dạng 2. Điện dung và năng lượng tụ điện', level: 'topic', grade: 11 }
            ]
          }
        ]
      },
      {
        id: 'g11-ch4',
        name: 'CHƯƠNG IV. DÒNG ĐIỆN KHÔNG ĐỔI & MẠCH ĐIỆN',
        level: 'chapter',
        grade: 11,
        children: []
      }
    ]
  },
  {
    id: 'grade-12',
    name: 'VẬT LÝ 12',
    level: 'grade',
    grade: 12,
    children: [
      {
        id: 'g12-ch1',
        name: 'CHƯƠNG I. VẬT LÝ NHIỆT',
        level: 'chapter',
        grade: 12,
        children: [
          {
            id: 'g12-ch1-l1',
            name: 'Bài 1. Cấu trúc chất và thang nhiệt độ',
            level: 'lesson',
            grade: 12,
            children: [
              { id: 'g12-ch1-l1-t1', name: 'Dạng 1. Mô hình động học phân tử chất', level: 'topic', grade: 12 },
              { id: 'g12-ch1-l1-t2', name: 'Dạng 2. Thang nhiệt độ Celsius và Kelvin', level: 'topic', grade: 12 }
            ]
          },
          {
            id: 'g12-ch1-l2',
            name: 'Bài 2. Nội năng và định luật I nhiệt động lực học',
            level: 'lesson',
            grade: 12,
            children: [
              { id: 'g12-ch1-l2-t1', name: 'Dạng 1. Độ biến thiên nội năng (Q và A)', level: 'topic', grade: 12 },
              { id: 'g12-ch1-l2-t2', name: 'Dạng 2. Nhiệt dung riêng và nhiệt nóng chảy riêng', level: 'topic', grade: 12 }
            ]
          }
        ]
      },
      {
        id: 'g12-ch2',
        name: 'CHƯƠNG II. KHÍ LÝ TƯỞNG',
        level: 'chapter',
        grade: 12,
        children: [
          {
            id: 'g12-ch2-l1',
            name: 'Bài 1. Thuyết động học phân tử chất khí',
            level: 'lesson',
            grade: 12,
            children: [
              { id: 'g12-ch2-l1-t1', name: 'Dạng 1. Áp suất phân tử khí lên thành bình', level: 'topic', grade: 12 }
            ]
          },
          {
            id: 'g12-ch2-l2',
            name: 'Bài 2. Các định luật chất khí & Phương trình trạng thái',
            level: 'lesson',
            grade: 12,
            children: [
              { id: 'g12-ch2-l2-t1', name: 'Dạng 1. Đẳng nhiệt (Boyle) & Đẳng tích (Charles)', level: 'topic', grade: 12 },
              { id: 'g12-ch2-l2-t2', name: 'Dạng 2. Phương trình trạng thái khí lý tưởng', level: 'topic', grade: 12 }
            ]
          }
        ]
      },
      {
        id: 'g12-ch3',
        name: 'CHƯƠNG III. TỪ TRƯỜNG',
        level: 'chapter',
        grade: 12,
        children: [
          {
            id: 'g12-ch3-l1',
            name: 'Bài 1. Từ trường và cảm ứng từ',
            level: 'lesson',
            grade: 12,
            children: [
              { id: 'g12-ch3-l1-t1', name: 'Dạng 1.1: Từ trường của dòng điện thẳng', level: 'topic', grade: 12 },
              { id: 'g12-ch3-l1-t2', name: 'Dạng 1.2: Từ trường của dòng điện tròn và ống dây', level: 'topic', grade: 12 },
              { id: 'g12-ch3-l1-t3', name: 'Dạng 1.3: Tổng hợp cảm ứng từ tại một điểm', level: 'topic', grade: 12 }
            ]
          },
          {
            id: 'g12-ch3-l2',
            name: 'Bài 2. Lực từ & Hiện tượng cảm ứng điện từ',
            level: 'lesson',
            grade: 12,
            children: [
              { id: 'g12-ch3-l2-t1', name: 'Dạng 2.1: Lực từ tác dụng lên đoạn dây dẫn', level: 'topic', grade: 12 },
              { id: 'g12-ch3-l2-t2', name: 'Dạng 2.2: Từ thông và suất điện động cảm ứng', level: 'topic', grade: 12 }
            ]
          }
        ]
      },
      {
        id: 'g12-ch4',
        name: 'CHƯƠNG IV. VẬT LÝ HẠT NHÂN',
        level: 'chapter',
        grade: 12,
        children: [
          {
            id: 'g12-ch4-l1',
            name: 'Bài 1. Cấu trúc hạt nhân & Năng lượng liên kết',
            level: 'lesson',
            grade: 12,
            children: [
              { id: 'g12-ch4-l1-t1', name: 'Dạng 1. Độ hụt khối và năng lượng liên kết', level: 'topic', grade: 12 }
            ]
          },
          {
            id: 'g12-ch4-l2',
            name: 'Bài 2. Phóng xạ và phản ứng hạt nhân',
            level: 'lesson',
            grade: 12,
            children: [
              { id: 'g12-ch4-l2-t1', name: 'Dạng 1. Định luật phóng xạ và chu kì bán rã', level: 'topic', grade: 12 },
              { id: 'g12-ch4-l2-t2', name: 'Dạng 2. Năng lượng tỏa ra trong phản ứng hạt nhân', level: 'topic', grade: 12 }
            ]
          }
        ]
      }
    ]
  }
];

const LOCAL_STORAGE_KEY = 'physivault_tree_custom_v1';

interface TreeTableOfContentsProps {
  blogs: BlogPost[];
  selectedItem: TreeSelection;
  onSelect: (selection: TreeSelection) => void;
  isAdmin?: boolean;
}

export const TreeTableOfContents: React.FC<TreeTableOfContentsProps> = ({
  blogs,
  selectedItem,
  onSelect,
  isAdmin = false,
}) => {
  // Cây thư mục hiện tại (tùy chỉnh được lưu trong localStorage)
  const [treeData, setTreeData] = useState<TreeNode[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (_) {}
    return INITIAL_PHYSICS_TREE;
  });

  // State tìm kiếm thư mục
  const [searchQuery, setSearchQuery] = useState('');
  
  // Set các node đang mở (expanded)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    // Mặc định mở Grade 12 và Chương III Từ trường để hiển thị mẫu ngay
    return new Set(['grade-12', 'g12-ch3', 'g12-ch3-l1']);
  });

  // Modal thêm node mới (Bài học hoặc Dạng bài)
  const [modalParent, setModalParent] = useState<{ id: string; level: 'lesson' | 'topic'; parentName: string } | null>(null);
  const [newNodeName, setNewNodeName] = useState('');

  // Lưu cây thư mục tùy chỉnh vào localStorage
  const saveTreeData = (newTree: TreeNode[]) => {
    setTreeData(newTree);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newTree));
    } catch (_) {}
  };

  // Khôi phục cây mặc định
  const handleResetToDefault = () => {
    if (window.confirm('Khôi phục cây mục lục về danh mục chuẩn ban đầu?')) {
      saveTreeData(INITIAL_PHYSICS_TREE);
      setExpandedNodes(new Set(['grade-12', 'g12-ch3', 'g12-ch3-l1']));
    }
  };

  // Toggle mở/đóng node
  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Tính toán số lượng bài tập theo từng node ─────────────
  const nodeCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    const countForNode = (node: TreeNode): number => {
      let c = 0;
      if (node.level === 'grade') {
        c = blogs.filter(b => b.grade === node.grade).length;
      } else {
        const rawName = node.name.toLowerCase();
        const cleanKeyword = rawName.replace(/^(chương|bài|dạng)\s*([0-9ivxabc\.\:\-]+)\s*[\.\:\-]?\s*/i, '').trim();
        const prefixMatch = rawName.match(/^(chương|bài|dạng)\s*([0-9ivxabc\.\:\-]+)/i);
        const prefixCode = prefixMatch ? prefixMatch[0].trim() : '';

        c = blogs.filter(b => {
          if (node.grade && b.grade && b.grade !== node.grade) return false;
          const cat = (b.category || '').toLowerCase();
          const title = (b.title || '').toLowerCase();
          const summary = (b.summary || '').toLowerCase();
          const tags = (b.tags || []).map(t => t.toLowerCase());

          if (prefixCode && (cat.includes(prefixCode) || tags.some(t => t.includes(prefixCode)))) {
            return true;
          }
          if (cleanKeyword && cleanKeyword.length >= 3) {
            if (cat.includes(cleanKeyword)) return true;
            if (tags.some(t => t.includes(cleanKeyword) || cleanKeyword.includes(t))) return true;
            if (title.includes(cleanKeyword) || summary.includes(cleanKeyword)) return true;
          }
          if (cat.includes(rawName) || tags.some(t => t.includes(rawName)) || title.includes(rawName)) {
            return true;
          }
          return false;
        }).length;

        if (node.children && node.children.length > 0) {
          const childSum = node.children.reduce((acc, child) => acc + countForNode(child), 0);
          c = Math.max(c, childSum);
        }
      }

      counts[node.id] = c;
      return c;
    };

    treeData.forEach(countForNode);
    return counts;
  }, [blogs, treeData]);

  // Tổng số câu trong kho
  const totalCount = blogs.length;

  // Lọc cây thư mục theo ô tìm kiếm
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return treeData;
    const q = searchQuery.toLowerCase().trim();

    const filterNode = (node: TreeNode): TreeNode | null => {
      const matchesSelf = node.name.toLowerCase().includes(q);
      const filteredChildren = (node.children || [])
        .map(filterNode)
        .filter((child): child is TreeNode => child !== null);

      if (matchesSelf || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }
      return null;
    };

    return treeData
      .map(filterNode)
      .filter((n): n is TreeNode => n !== null);
  }, [treeData, searchQuery]);

  // Tự động mở các node khi có tìm kiếm
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const allIds = new Set<string>();
    const collectIds = (nodes: TreeNode[]) => {
      nodes.forEach(n => {
        allIds.add(n.id);
        if (n.children) collectIds(n.children);
      });
    };
    collectIds(filteredTree);
    setExpandedNodes(allIds);
  }, [searchQuery, filteredTree]);

  // Thêm Bài học hoặc Dạng bài mới
  const handleAddNewNode = () => {
    if (!modalParent || !newNodeName.trim()) return;
    const { id: parentId, level } = modalParent;

    const newChild: TreeNode = {
      id: `custom-${Date.now()}`,
      name: newNodeName.trim(),
      level: level,
      parentId: parentId,
      isCustom: true,
      children: level === 'lesson' ? [] : undefined,
    };

    const addRecursively = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map(node => {
        if (node.id === parentId) {
          return {
            ...node,
            children: [...(node.children || []), newChild],
          };
        }
        if (node.children) {
          return {
            ...node,
            children: addRecursively(node.children),
          };
        }
        return node;
      });
    };

    const updated = addRecursively(treeData);
    saveTreeData(updated);
    setExpandedNodes(prev => new Set([...prev, parentId]));
    setModalParent(null);
    setNewNodeName('');
  };

  // Xóa node tùy chỉnh
  const handleDeleteNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Xóa mục này khỏi cây mục lục?')) return;

    const removeRecursively = (nodes: TreeNode[]): TreeNode[] => {
      return nodes
        .filter(n => n.id !== id)
        .map(n => ({
          ...n,
          children: n.children ? removeRecursively(n.children) : undefined,
        }));
    };

    const updated = removeRecursively(treeData);
    saveTreeData(updated);
  };

  return (
    <div className="w-full bg-[#FFFFFF] rounded-2xl border border-[#E8E6E1] shadow-xs flex flex-col h-[740px] overflow-hidden select-none" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* ── Custom Scrollbar Style ── */}
      <style>{`
        .physivault-tree-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .physivault-tree-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .physivault-tree-scroll::-webkit-scrollbar-thumb {
          background: #A25B60;
          border-radius: 9999px;
        }
        .physivault-tree-scroll::-webkit-scrollbar-thumb:hover {
          background: #843E43;
        }
      `}</style>

      {/* ── Top Search Bar ── */}
      <div className="p-3 border-b border-[#EAE8E4] bg-[#FAFAF9]">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-[#8F8E8C] absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm thư mục..."
            className="w-full pl-8 pr-7 py-1.5 rounded-lg text-xs bg-white border border-[#E2E0DB] text-[#1A1A1A] placeholder-[#9E9B97] focus:outline-none focus:border-[#C4630A] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 text-[#8F8E8C] hover:text-[#1A1A1A] p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Root item: Tất cả (Icon Layers) ── */}
      <div className="px-2 pt-2 pb-1 border-b border-[#F0EFEB]">
        <button
          onClick={() => onSelect({ type: 'all' })}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            selectedItem.type === 'all'
              ? 'bg-[#FDF4E7] text-[#8C4A00] border border-[#F6E1C4]'
              : 'text-[#37352F] hover:bg-[#F7F6F3]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#C4630A]" />
            <span className="text-[12.5px] font-bold">Tất cả</span>
          </div>
          <span className={`text-[11px] tabular-nums font-semibold ${selectedItem.type === 'all' ? 'text-[#8C4A00]' : 'text-[#8F8E8C]'}`}>
            {totalCount}
          </span>
        </button>
      </div>

      {/* ── Scrollable Tree View với thanh cuộn chuẩn ảnh mẫu ── */}
      <div className="physivault-tree-scroll flex-1 overflow-y-auto px-2 py-1.5 space-y-0.5 text-xs">
        {filteredTree.map(gradeNode => {
          const isGradeExpanded = expandedNodes.has(gradeNode.id);
          const isGradeSelected = selectedItem.type === 'grade' && selectedItem.grade === gradeNode.grade;
          const gradeCount = nodeCounts[gradeNode.id] || 0;

          return (
            <div key={gradeNode.id} className="space-y-0.5">
              {/* ── CẤP 1: KHỐI LỚP (VẬT LÝ 10, 11, 12) ── */}
              <div
                onClick={() => onSelect({ type: 'grade', grade: gradeNode.grade, name: gradeNode.name, id: gradeNode.id })}
                className={`group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-all ${
                  isGradeSelected
                    ? 'bg-[#FDF4E7] text-[#8C4A00] font-bold border border-[#F6E1C4]'
                    : 'text-[#37352F] hover:bg-[#F7F6F3]'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    onClick={(e) => toggleExpand(gradeNode.id, e)}
                    className="p-0.5 rounded hover:bg-black/5 text-[#787774] transition-colors"
                  >
                    {isGradeExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[#555]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[#555]" />
                    )}
                  </span>
                  
                  {/* Icon folder vàng chuẩn ảnh mẫu */}
                  <Folder className="w-4 h-4 fill-[#F5A623] text-[#D9730D] shrink-0" strokeWidth={1.2} />

                  <span className="font-bold truncate text-[12px] tracking-wide">
                    {gradeNode.name}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] tabular-nums font-semibold ${
                    isGradeSelected ? 'text-[#8C4A00]' : 'text-[#8F8E8C]'
                  }`}>
                    {gradeCount}
                  </span>
                </div>
              </div>

              {/* ── CẤP 2: CÁC CHƯƠNG (Có đường gióng thẳng & nhánh ngang) ── */}
              {isGradeExpanded && gradeNode.children && (
                <div className="relative pl-5 my-0.5 space-y-0.5">
                  {gradeNode.children.map((chNode, chIdx, chArr) => {
                    const isChExpanded = expandedNodes.has(chNode.id);
                    const isChSelected = selectedItem.type === 'chapter' && selectedItem.id === chNode.id;
                    const chCount = nodeCounts[chNode.id] || 0;
                    const isChLast = chIdx === chArr.length - 1;

                    return (
                      <div key={chNode.id} className="relative space-y-0.5">
                        {/* Đường gióng dọc của Cấp 2 */}
                        <div
                          className="absolute -left-[14px] top-0 w-[1px] bg-[#666663]"
                          style={{
                            bottom: isChLast ? 'calc(100% - 13px)' : '0px'
                          }}
                        />
                        {/* Nhánh ngang kết nối đến icon */}
                        <div className="absolute -left-[14px] top-[13px] w-[11px] h-[1px] bg-[#666663]" />

                        {/* Hàng Chương */}
                        <div
                          onClick={() => onSelect({ type: 'chapter', id: chNode.id, name: chNode.name, grade: gradeNode.grade })}
                          className={`group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-all ${
                            isChSelected
                              ? 'bg-[#FDF4E7] text-[#8C4A00] font-bold border border-[#F6E1C4]'
                              : 'text-[#37352F] hover:bg-[#F7F6F3]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 pr-1">
                            <span
                              onClick={(e) => toggleExpand(chNode.id, e)}
                              className="p-0.5 rounded hover:bg-black/5 text-[#555]"
                            >
                              {chNode.children && chNode.children.length > 0 ? (
                                isChExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
                              ) : (
                                <span className="w-3 inline-block" />
                              )}
                            </span>
                            <Folder className="w-3.5 h-3.5 fill-[#F5A623] text-[#D9730D] shrink-0" strokeWidth={1.2} />
                            <span className="truncate text-[11px] font-semibold leading-tight">
                              {chNode.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Nút thêm bài học cho giáo viên / admin */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalParent({ id: chNode.id, level: 'lesson', parentName: chNode.name });
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#EAE8E4] text-[#787774] hover:text-[#C4630A] transition-all"
                              title="Thêm Bài học mới vào chương này"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <span className="text-[10.5px] tabular-nums font-normal text-[#8F8E8C]">
                              {chCount}
                            </span>
                          </div>
                        </div>

                        {/* ── CẤP 3: CÁC BÀI HỌC ── */}
                        {isChExpanded && chNode.children && (
                          <div className="relative pl-5 my-0.5 space-y-0.5">
                            {chNode.children.map((lessonNode, lIdx, lArr) => {
                              const isLesExpanded = expandedNodes.has(lessonNode.id);
                              const isLesSelected = selectedItem.type === 'lesson' && selectedItem.id === lessonNode.id;
                              const lesCount = nodeCounts[lessonNode.id] || 0;
                              const isLesLast = lIdx === lArr.length - 1;

                              return (
                                <div key={lessonNode.id} className="relative space-y-0.5">
                                  {/* Đường gióng dọc của Cấp 3 */}
                                  <div
                                    className="absolute -left-[14px] top-0 w-[1px] bg-[#666663]"
                                    style={{
                                      bottom: isLesLast ? 'calc(100% - 13px)' : '0px'
                                    }}
                                  />
                                  {/* Nhánh ngang kết nối đến icon */}
                                  <div className="absolute -left-[14px] top-[13px] w-[11px] h-[1px] bg-[#666663]" />

                                  {/* Hàng Bài học */}
                                  <div
                                    onClick={() => onSelect({ type: 'lesson', id: lessonNode.id, name: lessonNode.name, grade: gradeNode.grade })}
                                    className={`group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-all ${
                                      isLesSelected
                                        ? 'bg-[#FDF4E7] text-[#8C4A00] font-bold border border-[#F6E1C4]'
                                        : 'text-[#474643] hover:bg-[#F7F6F3]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                      <span
                                        onClick={(e) => toggleExpand(lessonNode.id, e)}
                                        className="p-0.5 rounded hover:bg-black/5 text-[#555]"
                                      >
                                        {lessonNode.children && lessonNode.children.length > 0 ? (
                                          isLesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
                                        ) : (
                                          <span className="w-3 inline-block" />
                                        )}
                                      </span>
                                      <Folder className="w-3.5 h-3.5 fill-[#F5A623] text-[#D9730D] shrink-0" strokeWidth={1.2} />
                                      <span className="truncate text-[11px] font-medium leading-tight">
                                        {lessonNode.name}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      {/* Nút thêm dạng bài mới */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setModalParent({ id: lessonNode.id, level: 'topic', parentName: lessonNode.name });
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#EAE8E4] text-[#787774] hover:text-[#C4630A] transition-all"
                                        title="Thêm Dạng bài mới vào bài này"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                      {lessonNode.isCustom && (
                                        <button
                                          onClick={(e) => handleDeleteNode(lessonNode.id, e)}
                                          className="opacity-0 group-hover:opacity-100 p-0.5 text-[#AEACA8] hover:text-red-500 transition-opacity"
                                          title="Xóa bài học tùy chỉnh"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                      <span className="text-[10px] tabular-nums font-normal text-[#8F8E8C]">
                                        {lesCount}
                                      </span>
                                    </div>
                                  </div>

                                  {/* ── CẤP 4: CÁC DẠNG BÀI ── */}
                                  {isLesExpanded && lessonNode.children && (
                                    <div className="relative pl-5 my-0.5 space-y-0.5">
                                      {lessonNode.children.map((topicNode, tIdx, tArr) => {
                                        const isTopSelected = selectedItem.type === 'topic' && selectedItem.id === topicNode.id;
                                        const topCount = nodeCounts[topicNode.id] || 0;
                                        const isTopLast = tIdx === tArr.length - 1;

                                        return (
                                          <div key={topicNode.id} className="relative">
                                            {/* Đường gióng dọc của Cấp 4 */}
                                            <div
                                              className="absolute -left-[14px] top-0 w-[1px] bg-[#666663]"
                                              style={{
                                                bottom: isTopLast ? 'calc(100% - 13px)' : '0px'
                                              }}
                                            />
                                            {/* Nhánh ngang kết nối đến icon dạng bài */}
                                            <div className="absolute -left-[14px] top-[13px] w-[11px] h-[1px] bg-[#666663]" />

                                            {/* Hàng Dạng bài (Khi chọn -> Highlight full hàng y chang ảnh mẫu) */}
                                            <div
                                              onClick={() => onSelect({ type: 'topic', id: topicNode.id, name: topicNode.name, grade: gradeNode.grade })}
                                              className={`group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-all ${
                                                isTopSelected
                                                  ? 'bg-[#F4F4F2] text-[#1A1A1A] font-semibold shadow-2xs'
                                                  : 'text-[#4F4D49] hover:bg-[#F7F6F3]'
                                              }`}
                                            >
                                              <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                                <Folder className="w-3.5 h-3.5 fill-[#F5A623] text-[#D9730D] shrink-0" strokeWidth={1.2} />
                                                <span className="truncate text-[10.5px] leading-tight">
                                                  {topicNode.name}
                                                </span>
                                              </div>

                                              <div className="flex items-center gap-1 shrink-0">
                                                {topicNode.isCustom && (
                                                  <button
                                                    onClick={(e) => handleDeleteNode(topicNode.id, e)}
                                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-[#AEACA8] hover:text-red-500 transition-opacity"
                                                    title="Xóa dạng bài tùy chỉnh"
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                  </button>
                                                )}
                                                <span className={`text-[10px] tabular-nums ${isTopSelected ? 'font-bold text-[#1A1A1A]' : 'text-[#8F8E8C]'}`}>
                                                  {topCount}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer bar: Reset to default button ── */}
      <div className="p-2 border-t border-[#EAE8E4] bg-[#FAFAF9] flex items-center justify-between text-[11px] text-[#8F8E8C]">
        <span>Chương trình GDPT 2018</span>
        <button
          onClick={handleResetToDefault}
          className="flex items-center gap-1 hover:text-[#1A1A1A] transition-colors p-1"
          title="Khôi phục lại cây thư mục ban đầu"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Đặt lại</span>
        </button>
      </div>

      {/* ── Modal Thêm Bài hoặc Dạng mới ── */}
      {modalParent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          onClick={() => setModalParent(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-[#E8E6E1] space-y-4 animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h4 className="text-sm font-bold text-[#1A1A1A]">
                Thêm {modalParent.level === 'lesson' ? 'Bài học mới' : 'Dạng bài mới'}
              </h4>
              <p className="text-xs text-[#787774] mt-0.5 truncate">
                Thuộc: <span className="font-semibold text-[#37352F]">{modalParent.parentName}</span>
              </p>
            </div>

            <div>
              <input
                type="text"
                value={newNodeName}
                onChange={e => setNewNodeName(e.target.value)}
                placeholder={modalParent.level === 'lesson' ? 'Ví dụ: Bài 3. Hiện tượng tự cảm' : 'Ví dụ: Dạng 1.4: Lực từ Lorentz'}
                className="w-full p-2.5 rounded-xl border border-[#E2E0DB] text-xs font-medium outline-none focus:border-[#C4630A]"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddNewNode();
                }}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalParent(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#787774] hover:bg-[#F7F6F3]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAddNewNode}
                disabled={!newNodeName.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-[#C4630A] hover:bg-[#A35208] disabled:opacity-50 transition-all shadow-2xs"
              >
                Thêm vào cây
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TreeTableOfContents;
