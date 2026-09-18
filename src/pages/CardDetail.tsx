import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { deleteCard } from '../services/mutations';
import { CardFace } from '../components/cards/CardFace';
import { CardDetailActions } from '../components/cards/CardDetailActions';
import { EmptyState } from '../components/common/Feedback';
import { Button } from '../components/common/Button';

export function CardDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const card = useLiveQuery(async () => {
    if (!id) return undefined;
    return db.cards.get(id);
  }, [id]);

  if (card === undefined) return null;

  if (!card || card.deletedAt) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon="🔍"
          title="未找到该单词"
          description="可能已被删除。"
          action={<Button onClick={() => navigate('/library')}>返回单词库</Button>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/library" className="hover:text-brand-600">单词库</Link>
        <span>/</span>
        <span className="truncate text-slate-700">{card.word}</span>
      </nav>
      <CardFace card={card} />
      <CardDetailActions
        card={card}
        onDelete={() => {
          void deleteCard(card.id).then(() => navigate('/library'));
        }}
      />
    </div>
  );
}