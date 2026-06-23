import type { Feedback, Submission } from "../types";

function ProgressBar({ label, value }: { label: string; value: number }) {
  const score = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div className="flex justify-between text-sm font-black">
        <span>{label}</span>
        <span className="text-navy">{score} / 100</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-navy" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="card p-5">
      <p className="section-title">{title}</p>
      <ul className="mt-3 space-y-2 text-sm font-bold leading-7 text-slate-700">
        {items.map((item) => <li key={item}>・{item}</li>)}
      </ul>
    </section>
  );
}

export function FeedbackResult({
  feedback,
  submission,
  onResubmit
}: {
  feedback: Feedback;
  submission?: Submission;
  onResubmit: () => void;
}) {
  const totalScore = Math.max(0, Math.min(100, Math.round(feedback.totalScore)));
  const scores = [
    ["文法の正確さ", feedback.grammarScore],
    ["語彙の自然さ", feedback.vocabularyScore],
    ["論理展開", feedback.logicScore],
    ["構成の明確さ", feedback.structureScore],
    ["内容の一貫性", feedback.consistencyScore]
  ];

  return (
    <div className="space-y-4 px-5 py-5">
      <section className="card p-5 text-center">
        <p className="section-title">AI添削結果</p>
        <div
          className="mx-auto mt-4 grid h-32 w-32 place-items-center rounded-full"
          style={{ background: `conic-gradient(#123a78 ${totalScore * 3.6}deg, #e8eef7 0deg)` }}
          aria-label={`総合スコア ${totalScore}点`}
        >
          <div className="grid h-24 w-24 place-items-center rounded-full bg-white shadow-inner">
            <span className="text-4xl font-black text-navy">{totalScore}</span>
          </div>
        </div>
        <p className="mt-2 text-sm font-black text-slate-500">100点満点スコア</p>
        {feedback.wordCountFeedback && <p className="mt-2 text-sm font-bold text-slate-600">{feedback.wordCountFeedback}</p>}
      </section>

      <section className="card p-5">
        <p className="section-title">5項目スコア</p>
        <div className="mt-4 space-y-3">
          {scores.map(([label, value]) => <ProgressBar key={label as string} label={label as string} value={value as number} />)}
        </div>
      </section>

      {submission?.answerText && (
        <section className="card p-5">
          <p className="section-title">あなたの回答</p>
          <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-mist p-4 text-sm font-bold leading-7 text-slate-800">{submission.answerText}</p>
        </section>
      )}

      <ListBlock title="良かった点" items={feedback.goodPoints} />
      <ListBlock title="改善ポイント" items={feedback.improvementPoints} />

      {!!feedback.sentenceCorrections?.length && (
        <section className="card p-5">
          <p className="section-title">文ごとの修正</p>
          <div className="mt-3 space-y-3">
            {feedback.sentenceCorrections.map((item, index) => (
              <div key={`${item.original}-${index}`} className="rounded-2xl bg-mist p-4 text-sm font-bold leading-7">
                <p className="text-slate-500">Original</p>
                <p>{item.original}</p>
                <p className="mt-2 text-slate-500">Corrected</p>
                <p className="text-navy">{item.corrected}</p>
                <p className="mt-2 text-slate-600">{item.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card p-5">
        <p className="section-title">修正版サンプル</p>
        <p className="mt-3 whitespace-pre-wrap text-sm font-bold leading-7">{feedback.correctedSample}</p>
      </section>

      <section className="card p-5">
        <p className="section-title">次回アドバイス</p>
        <p className="mt-3 text-sm font-bold leading-7">{feedback.nextAdvice}</p>
      </section>

      <button className="primary-button w-full" onClick={onResubmit}>再提出する</button>
    </div>
  );
}
