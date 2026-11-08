import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Folder, FolderOpen, ChevronRight, FileText,
  Search, Plus, Pencil, Trash2, Layers, X, RotateCcw
} from 'lucide-react';
import { BlogPost } from '../types';

export interface TreeNode {
  id: string;
  name: string;
  previousNames?: string[];
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

export function loadPhysicsTree(): TreeNode[] {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || 'null');
    if (Array.isArray(saved)) return saved;
  } catch {
    // Storage can be unavailable, such as when rendering on the server.
  }
  return INITIAL_PHYSICS_TREE;
}

export function savePhysicsTree(tree: TreeNode[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tree));
  } catch {
    // The current session can still use the updated tree.
  }
}

export function selectTreeNode(node: TreeNode, grade = node.grade): TreeSelection {
  return { type: node.level, id: node.id, name: node.name, grade };
}

export function normalizeSearchText(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
}

export function indexFolderBlogs(tree: TreeNode[], blogs: BlogPost[]) {
  const byFolder = new Map<string, Set<string>>();
  const searchable = blogs.map(blog => ({
    id: blog.id,
    grade: blog.grade,
    title: normalizeSearchText(blog.title || ''),
    summary: normalizeSearchText(blog.summary || ''),
    labels: [blog.category || '', ...(blog.tags || [])].map(normalizeSearchText).filter(Boolean),
  }));

  const getFolderTerms = (label: string) => {
    const name = normalizeSearchText(label);
    const numberedName = name.match(/^(chuong|bai|dang) ([ivxlcdm]+|\d+(?:\.\d+)*)(?:[.:\-]\s*|\s+|$)/);
    const keyword = numberedName ? name.slice(numberedName[0].length).trim() : name;
    const numberLabel = numberedName ? numberedName[1] + ' ' + numberedName[2] : '';
    return { name, keyword, numberLabel };
  };

  const indexNode = (node: TreeNode, grade = node.grade) => {
    const terms = [node.name, ...(node.previousNames ?? [])].map(getFolderTerms);
    const ids = new Set<string>();

    for (const blog of searchable) {
      if (node.level === 'grade') {
        if (blog.grade === grade) ids.add(blog.id);
        continue;
      }
      if (blog.grade && grade && blog.grade !== grade) continue;
      if (terms.some(({ name, keyword, numberLabel }) =>
        blog.title.includes(name) || blog.labels.some(label => label.includes(name) || label === numberLabel)
        || (keyword.length >= 3 && (
          blog.title.includes(keyword) || blog.summary.includes(keyword)
          || blog.labels.some(label => label.includes(keyword) || (label.length >= 3 && keyword.includes(label)))
        )))) {
        ids.add(blog.id);
      }
    }

    for (const child of node.children ?? []) {
      for (const id of indexNode(child, grade)) ids.add(id);
    }
    byFolder.set(node.id, ids);
    return ids;
  };

  tree.forEach(node => indexNode(node));
  return byFolder;
}

export function findNodePath(nodes: TreeNode[], id?: string): TreeNode[] {
  if (!id) return [];
  for (const node of nodes) {
    if (node.id === id) return [node];
    const childPath = findNodePath(node.children ?? [], id);
    if (childPath.length) return [node, ...childPath];
  }
  return [];
}

function filterFolders(nodes: TreeNode[], query: string): TreeNode[] {
  return nodes.flatMap(node => {
    if ([node.name, ...(node.previousNames ?? [])].some(name => normalizeSearchText(name).includes(query))) return [node];
    const children = filterFolders(node.children ?? [], query);
    return children.length ? [{ ...node, children }] : [];
  });
}

const iconButton = 'grid size-8 shrink-0 place-items-center rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600';
const selectedRow = 'bg-amber-50 text-amber-950 ring-1 ring-inset ring-amber-200';
const labelStyles = {
  grade: 'text-sm font-bold tracking-wide',
  chapter: 'text-xs font-semibold',
  lesson: 'text-sm font-medium',
  topic: 'text-[13px]',
};

interface TreeTableOfContentsProps {
  treeData: TreeNode[];
  folderBlogs: Map<string, Set<string>>;
  totalCount: number;
  selectedItem: TreeSelection;
  onSelect: (selection: TreeSelection) => void;
  onTreeChange: (tree: TreeNode[]) => void;
  isAdmin: boolean;
}

export const TreeTableOfContents: React.FC<TreeTableOfContentsProps> = ({
  treeData,
  folderBlogs,
  totalCount,
  selectedItem,
  onSelect,
  onTreeChange,
  isAdmin,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState(() => new Set<string>());
  const [collapsedResults, setCollapsedResults] = useState(() => new Set<string>());
  const [folderEditor, setFolderEditor] = useState<{ mode: 'add' | 'rename'; node: TreeNode } | null>(null);
  const [newNodeName, setNewNodeName] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const query = normalizeSearchText(searchQuery);
  const visibleTree = useMemo(() => query ? filterFolders(treeData, query) : treeData, [treeData, query]);

  useEffect(() => {
    const path = findNodePath(treeData, selectedItem.id);
    if (path.length) {
      setExpandedNodes(previous => new Set([...previous, ...path.map(node => node.id)]));
    }
  }, [selectedItem.id, treeData]);

  useEffect(() => {
    if (folderEditor) dialogRef.current?.showModal();
  }, [folderEditor]);

  const updateSearch = (value: string) => {
    setSearchQuery(value);
    setCollapsedResults(new Set());
  };

  const toggleBranch = (id: string) => {
    const setBranchState = query ? setCollapsedResults : setExpandedNodes;
    setBranchState(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openFolderEditor = (mode: 'add' | 'rename', node: TreeNode) => {
    setNewNodeName(mode === 'rename' ? node.name : '');
    setFolderEditor({ mode, node });
  };

  const saveFolder = (event: React.FormEvent) => {
    event.preventDefault();
    const name = newNodeName.trim();
    if (!isAdmin || !folderEditor || !name) return;
    const path = findNodePath(treeData, folderEditor.node.id);
    const current = path.at(-1);
    if (!current) return;

    const update = (nodes: TreeNode[], depth = 0): TreeNode[] => nodes.map(node => {
      if (node.id !== path[depth].id) return node;
      if (node.id !== current.id) return { ...node, children: update(node.children ?? [], depth + 1) };
      if (folderEditor.mode === 'rename') {
        const previousNames = [...new Set([...(node.previousNames ?? []), node.name])].filter(label => label !== name);
        return { ...node, name, previousNames };
      }
      const child: TreeNode = {
        id: 'custom-' + crypto.randomUUID(),
        name,
        grade: path[0].grade,
        level: node.level === 'chapter' ? 'lesson' : 'topic',
        parentId: node.id,
        isCustom: true,
      };
      return { ...node, children: [...(node.children ?? []), child] };
    });
    onTreeChange(update(treeData));
    if (folderEditor.mode === 'add') {
      setExpandedNodes(previous => new Set([...previous, ...path.map(node => node.id)]));
      updateSearch('');
    }
    dialogRef.current?.close();
  };

  const deleteFolder = (id: string) => {
    if (!isAdmin || !window.confirm('Xóa thư mục tùy chỉnh này và các thư mục con?')) return;
    const remove = (nodes: TreeNode[]): TreeNode[] => nodes.filter(node => node.id !== id)
      .map(node => node.children ? { ...node, children: remove(node.children) } : node);
    onTreeChange(remove(treeData));
  };

  const renderFolder = (node: TreeNode, grade = node.grade): React.ReactNode => {
    const children = node.children ?? [];
    const hasChildren = children.length > 0;
    const expanded = hasChildren && (query ? !collapsedResults.has(node.id) : expandedNodes.has(node.id));
    const selected = selectedItem.id === node.id;
    const canAdd = isAdmin && (node.level === 'chapter' || node.level === 'lesson');
    const canRename = isAdmin && (node.level === 'lesson' || node.level === 'topic');
    const addLabel = node.level === 'chapter' ? 'Thêm bài học' : 'Thêm dạng bài';
    const count = folderBlogs.get(node.id)?.size ?? 0;
    const Icon = node.level === 'topic' ? FileText : expanded ? FolderOpen : Folder;

    return (
      <li key={node.id} className="min-w-0">
        <div className={'flex min-w-0 items-center gap-0.5 rounded-lg pr-1 ' + (selected ? selectedRow : 'text-stone-700 hover:bg-stone-50')}>
          {hasChildren ? (
            <button type="button" className={iconButton}
              aria-expanded={expanded} aria-label={(expanded ? 'Thu gọn ' : 'Mở ') + node.name}
              onClick={() => toggleBranch(node.id)}>
              <ChevronRight aria-hidden="true" className={'size-4 transition-transform motion-reduce:transition-none ' + (expanded ? 'rotate-90' : '')} />
            </button>
          ) : <span className="w-3 shrink-0" aria-hidden="true" />}
          <button type="button" aria-pressed={selected} title={node.name}
            className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600"
            onClick={() => {
              if (hasChildren && !expanded) toggleBranch(node.id);
              onSelect(selectTreeNode(node, grade));
            }}>
            <Icon aria-hidden="true" className={'size-4 shrink-0 ' + (node.level === 'topic' ? 'text-stone-500' : 'fill-amber-100 text-amber-700')} />
            <span className={'line-clamp-2 min-w-0 flex-1 break-words leading-snug ' + labelStyles[node.level]}>{node.name}</span>
            <span aria-label={count + ' câu'} className="min-w-5 shrink-0 rounded-md bg-stone-100 px-1 py-0.5 text-center text-[11px] font-medium tabular-nums text-stone-600">
              {count}
            </span>
          </button>
          {canAdd && (
            <button type="button" className={iconButton} aria-label={addLabel + ' vào ' + node.name}
              title={addLabel} onClick={() => openFolderEditor('add', node)}>
              <Plus aria-hidden="true" className="size-4" />
            </button>
          )}
          {canRename && (
            <button type="button" className={iconButton} aria-label={'Đổi tên ' + node.name}
              title="Đổi tên" onClick={() => openFolderEditor('rename', node)}>
              <Pencil aria-hidden="true" className="size-3.5" />
            </button>
          )}
          {isAdmin && node.isCustom && (
            <button type="button" className={iconButton + ' hover:text-red-700'} aria-label={'Xóa ' + node.name}
              title="Xóa thư mục tùy chỉnh" onClick={() => deleteFolder(node.id)}>
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          )}
        </div>
        {expanded && (
          <ul className="ml-3 space-y-0.5 border-l border-stone-200 pl-1.5">
            {children.map(child => renderFolder(child, grade))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-stone-100 px-3 pb-3">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-stone-500" />
          <input ref={searchRef} type="text" aria-label="Tìm thư mục" placeholder="Tìm thư mục..."
            value={searchQuery} onChange={event => updateSearch(event.target.value)}
            className="h-10 w-full rounded-lg border border-stone-200 bg-stone-50 pl-9 pr-10 text-sm text-stone-900 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600" />
          {searchQuery && (
            <button type="button" className={iconButton + ' absolute right-1 top-1'} aria-label="Xóa từ khóa"
              onClick={() => { updateSearch(''); searchRef.current?.focus(); }}>
              <X aria-hidden="true" className="size-4" />
            </button>
          )}
        </div>
        <button type="button" aria-pressed={selectedItem.type === 'all'} onClick={() => onSelect({ type: 'all' })}
          className={'flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600 '
            + (selectedItem.type === 'all' ? selectedRow : 'text-stone-700 hover:bg-stone-50')}>
          <Layers aria-hidden="true" className="size-4 text-amber-700" />
          <span className="flex-1">Tất cả</span>
          <span aria-label={totalCount + ' câu'} className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs tabular-nums text-amber-900">{totalCount}</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        {visibleTree.length ? (
          <ul aria-label="Thư mục Vật lý" className="space-y-0.5">{visibleTree.map(node => renderFolder(node))}</ul>
        ) : (
          <p role="status" className="px-3 py-6 text-center text-sm text-stone-600">Không tìm thấy thư mục phù hợp.</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-stone-100 px-3 py-2 text-xs text-stone-600">
        <span>Chương trình GDPT 2018</span>
        {isAdmin && (
          <button type="button" className="flex min-h-8 items-center gap-1 rounded px-1 hover:text-amber-800"
            onClick={() => {
              if (!window.confirm('Khôi phục cây mục lục về danh mục chuẩn ban đầu?')) return;
              onTreeChange(INITIAL_PHYSICS_TREE);
              setExpandedNodes(new Set());
              updateSearch('');
              onSelect({ type: 'all' });
            }}>
            <RotateCcw aria-hidden="true" className="size-3.5" /> Đặt lại
          </button>
        )}
      </div>

      {folderEditor && (
        <dialog ref={dialogRef} aria-labelledby="physics-folder-dialog-title" onClose={() => setFolderEditor(null)}
          className="w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-stone-200 p-5 text-stone-900 shadow-xl backdrop:bg-black/40">
          <form onSubmit={saveFolder} className="space-y-3">
            <h2 id="physics-folder-dialog-title" className="text-base font-bold">
              {folderEditor.mode === 'rename'
                ? (folderEditor.node.level === 'lesson' ? 'Đổi tên bài học' : 'Đổi tên dạng bài')
                : (folderEditor.node.level === 'chapter' ? 'Thêm bài học' : 'Thêm dạng bài')}
            </h2>
            {folderEditor.mode === 'add' && <p className="text-sm text-stone-600">{folderEditor.node.name}</p>}
            <label className="block space-y-1 text-sm font-medium">
              <span>Tên thư mục</span>
              <input autoFocus required value={newNodeName} onChange={event => setNewNodeName(event.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600" />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => dialogRef.current?.close()}
                className="rounded-lg px-3 py-2 text-sm hover:bg-stone-100">Hủy</button>
              <button type="submit" disabled={!newNodeName.trim() || (folderEditor.mode === 'rename' && newNodeName.trim() === folderEditor.node.name)}
                className="rounded-lg bg-amber-800 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:opacity-50">
                {folderEditor.mode === 'rename' ? 'Lưu tên' : 'Thêm thư mục'}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
};

export default TreeTableOfContents;
