import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Card } from '../../types';
import { Button } from '../common/Button';
import { ConfirmDialog } from '../common/Dialog';

interface Props {
  card: Card;
  onDelete?: () => void;
}

export function CardDetailActions({ card, onDelete }: Props) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => navigate(`/library/${card.id}/edit`)}>开始编辑 ✏️</Button>
        <Button variant="ghost" onClick={() => navigate('/library')}>返回词库</Button>
        <Button
          variant="ghost"
          className="ml-auto text-red-500 hover:text-red-600"
          onClick={() => setConfirmDelete(true)}
        >
          删除
        </Button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="删除单词"
        message={`确定删除「${card.word}」？此操作不可撤销，复习进度将一起删除。`}
        confirmText="确认删除"
        danger
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete?.();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}