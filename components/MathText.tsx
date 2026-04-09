import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';

interface MathTextProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

const MathText: React.FC<MathTextProps> = ({ content, className, style }) => {
  return (
    <div className={`prose prose-sm max-w-none ${className || ''}`} style={style}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={{
          p: ({ node, ...props }) => <p style={{ margin: 0 }} {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MathText;
