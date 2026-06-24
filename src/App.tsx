import { FormEvent, useEffect, useMemo, useState } from "react";
import { prints, levels, getPrintByCode } from "./data/prints";
import { loadAdminStats, type AdminStats } from "./lib/adminData";
import { canUseSupabaseAuth, getCurrentProfile, signInWithEmail, signInWithProvider, signOut, signUpWithEmail } from "./lib/auth";
import { loadCloudLearningState, setCloudFavorite, upsertCloudProgress } from "./lib/cloudData";
import { gradeEssay } from "./lib/gradeEssay";
import {
  clearDraft,
  getDrafts,
  getFavorites,
  getProfile,
  getProgress,
  getSubmissions,
  saveDraft,
  saveFavorites,
  saveProfile,
  saveProgress,
  saveSubmissions
} from "./lib/storage";
import { FeedbackResult } from "./pages/FeedbackResult";
import type { Feedback, Level, PrintItem, PrintProgress, Submission, UserProfile } from "./types";
import writeOneLogo from "./assets/writeone-logo.png";

type View = "home" | "prints" | "detail" | "answer" | "confirm" | "feedback" | "history" | "progress" | "profile" | "admin";

const levelNames: Record<Level, string> = {
  Opinion: "Opinion",
  Essay: "Essay",
  Advanced: "Advanced",
  Master: "Master"
};

type NavIconName = "home" | "prints" | "progress" | "history" | "profile";

const navItems: { view: View; label: string; icon: NavIconName }[] = [
  { view: "home", label: "ホーム", icon: "home" },
  { view: "prints", label: "プリント", icon: "prints" },
  { view: "progress", label: "進捗", icon: "progress" },
  { view: "history", label: "履歴", icon: "history" },
  { view: "profile", label: "マイページ", icon: "profile" }
];

function NavIcon({ name }: { name: NavIconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2.2
  };

  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      {name === "home" && (
        <>
          <path {...common} d="M3.5 11.2 12 4l8.5 7.2" />
          <path {...common} d="M6.5 10.7V20h11v-9.3" />
          <path {...common} d="M10 20v-5h4v5" />
        </>
      )}
      {name === "prints" && (
        <>
          <path {...common} d="M7 3.8h7l3 3V20.2H7z" />
          <path {...common} d="M14 3.8v3h3" />
          <path {...common} d="M9.5 11h5" />
          <path {...common} d="M9.5 14.5h5" />
        </>
      )}
      {name === "progress" && (
        <>
          <path {...common} d="M4 19V5" />
          <path {...common} d="M4 19h16" />
          <path {...common} d="M8 15.5v-4" />
          <path {...common} d="M12 15.5V8" />
          <path {...common} d="M16 15.5v-6" />
        </>
      )}
      {name === "history" && (
        <>
          <path {...common} d="M5 7.5h10.5A4.5 4.5 0 0 1 20 12v0a4.5 4.5 0 0 1-4.5 4.5H7" />
          <path {...common} d="M7.5 4.8 4.8 7.5l2.7 2.7" />
          <path {...common} d="M12 9.2V12l2.2 1.5" />
        </>
      )}
      {name === "profile" && (
        <>
          <circle {...common} cx="12" cy="8" r="3.2" />
          <path {...common} d="M5.5 19.5c.8-3.4 3.1-5.1 6.5-5.1s5.7 1.7 6.5 5.1" />
        </>
      )}
    </svg>
  );
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function initialProgress(ownerId?: string | null): Record<string, PrintProgress> {
  const stored = getProgress(ownerId);
  for (const level of levels) {
    const first = prints.find((item) => item.level === level);
    if (first && !stored[first.id]) {
      stored[first.id] = { printId: first.id, status: "unlocked" };
    }
  }
  return stored;
}

function statusFor(print: PrintItem, progress: Record<string, PrintProgress>) {
  if (import.meta.env.VITE_ENABLE_DEV_UNLOCK === "true") {
    return progress[print.id]?.status === "completed" ? "completed" : "unlocked";
  }
  return progress[print.id]?.status ?? "locked";
}

function nextPrint(progress: Record<string, PrintProgress>) {
  return prints.find((print) => statusFor(print, progress) === "unlocked") ?? prints[0];
}

function totalStudyDays(submissions: Submission[]) {
  return new Set(submissions.map((item) => item.createdAt.slice(0, 10))).size;
}

function fileToImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("画像を読み込めませんでした。"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("画像を読み込めませんでした。"));
      img.onload = () => {
        const maxSize = 1600;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("画像を処理できませんでした。"));
          return;
        }
        context.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function Login({ onLogin }: { onLogin: (profile: UserProfile) => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const supabaseAuth = canUseSupabaseAuth();

  function demoLogin(values?: { email?: string; name?: string }) {
    const profile: UserProfile = {
      id: crypto.randomUUID(),
      email: values?.email ?? (email || "demo@writeone.app"),
      displayName: values?.name ?? (name || "山田太郎"),
      createdAt: new Date().toISOString(),
      subscriptionPlan: "Free",
      subscriptionStatus: "active"
    };
    saveProfile(profile);
    onLogin(profile);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!supabaseAuth) {
        demoLogin();
        return;
      }
      if (!email || !password) {
        throw new Error("メールアドレスとパスワードを入力してください。");
      }
      const profile = mode === "signup"
        ? await signUpWithEmail({ email, password, displayName: name || "山田太郎" })
        : await signInWithEmail(email, password);
      saveProfile(profile);
      onLogin(profile);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ログインに失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-mist px-5 py-8">
      <section className="mx-auto max-w-md overflow-hidden rounded-[28px] bg-white shadow-soft">
        <div className="top-gradient px-6 py-9">
          <div className="rounded-[24px] bg-white p-4 shadow-soft">
            <img
              src={writeOneLogo}
              alt="WriteOne - 毎日1枚で、英作文力を伸ばす。"
              className="mx-auto h-auto w-full max-w-[280px]"
            />
          </div>
          <p className="mt-4 text-sm font-bold leading-7 text-white/85">
            英検準1級〜1級レベルまで対応。AI添削で、書く力が確実に伸びる。
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4 px-6 py-7">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-mist p-1">
            <button type="button" className={`rounded-xl py-2 text-sm font-black ${mode === "signin" ? "bg-white text-navy shadow-soft" : "text-slate-500"}`} onClick={() => setMode("signin")}>ログイン</button>
            <button type="button" className={`rounded-xl py-2 text-sm font-black ${mode === "signup" ? "bg-white text-navy shadow-soft" : "text-slate-500"}`} onClick={() => setMode("signup")}>新規登録</button>
          </div>
          {mode === "signup" && <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ユーザー名" />}
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="メールアドレス" type="email" />
          <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="パスワード（6文字以上）" type="password" />
          <button className="primary-button w-full" type="submit" disabled={loading}>{loading ? "処理中..." : mode === "signup" ? "メールで新規登録" : "メールでログイン"}</button>
          <div className="grid grid-cols-2 gap-3">
            <button className="secondary-button" type="button" onClick={() => supabaseAuth ? signInWithProvider("google").catch((caught) => setError(caught.message)) : demoLogin({ email: "google-user@writeone.app", name: "山田太郎" })}>Google</button>
            <button className="secondary-button" type="button" onClick={() => supabaseAuth ? signInWithProvider("apple").catch((caught) => setError(caught.message)) : demoLogin({ email: "apple-user@writeone.app", name: "山田太郎" })}>Apple</button>
          </div>
          {!supabaseAuth && <p className="rounded-2xl bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-700">Supabase未設定のためデモログインで動作します。</p>}
          {error && <p className="rounded-2xl bg-red-50 p-3 text-xs font-bold leading-5 text-red-700">{error}</p>}
          <button className="text-sm font-black text-navy" type="button" onClick={() => alert("Supabase接続後にパスワードリセットメールを送信します。")}>パスワードをリセット</button>
        </form>
      </section>
    </main>
  );
}

function InstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (hidden) return null;

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-title">PWAインストール</p>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-600">ホーム画面に追加すると、アプリのようにすぐ開けます。</p>
        </div>
        <button className="text-sm font-black text-slate-400" onClick={() => setHidden(true)}>閉じる</button>
      </div>
      <button
        className="secondary-button mt-4 w-full"
        onClick={async () => {
          if (prompt?.prompt) {
            await prompt.prompt();
            setPrompt(null);
          } else {
            alert("ブラウザメニューから「ホーム画面に追加」を選択してください。");
          }
        }}
      >
        ホーム画面に追加
      </button>
    </section>
  );
}

function Header({ profile }: { profile: UserProfile }) {
  return (
    <header className="top-gradient rounded-b-[32px] px-5 pb-7 pt-5">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-white/70">WriteOne</p>
            <h1 className="mt-1 text-2xl font-black">こんにちは、{profile.displayName}</h1>
          </div>
          <div className="rounded-2xl bg-white/12 px-3 py-2 text-right">
            <p className="text-[11px] font-black text-white/70">Plan</p>
            <p className="text-sm font-black">{profile.subscriptionPlan}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

function BackButton({ view, onBack }: { view: View; onBack: () => void }) {
  const show = ["detail", "answer", "confirm", "feedback", "admin"].includes(view);
  if (!show) return null;

  return (
    <div className="mx-auto max-w-5xl px-5 pt-4">
      <button
        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-navy shadow-soft"
        onClick={onBack}
      >
        <span aria-hidden="true">←</span>
        <span>戻る</span>
      </button>
    </div>
  );
}

function Home({
  progress,
  submissions,
  onOpen,
  onOpenFeedback
}: {
  progress: Record<string, PrintProgress>;
  submissions: Submission[];
  onOpen: (print: PrintItem, view?: View) => void;
  onOpenFeedback: (submission: Submission) => void;
}) {
  const today = nextPrint(progress);
  const completedToday = submissions.some((item) => item.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10));
  const recent = submissions.slice(-3).reverse();

  return (
    <div className="space-y-5 px-5 py-5">
      <section className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-title">今日のプリント</p>
            <h2 className="mt-3 text-3xl font-black text-navy">{today.code}</h2>
            <p className="mt-1 text-sm font-black text-slate-500">{today.level} / {today.wordCountMin}〜{today.wordCountMax}語</p>
          </div>
          <span className="pill">{completedToday ? "学習済み" : "未学習"}</span>
        </div>
        <p className="mt-4 text-lg font-black leading-8">{today.topicJp}</p>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <Metric label="所要時間" value="15分" />
          <Metric label="累計学習" value={`${totalStudyDays(submissions)}日`} />
          <Metric label="平均点" value={`${averageScore(submissions)}点`} />
        </div>
        <button className="primary-button mt-5 w-full" onClick={() => onOpen(today)}>始める</button>
      </section>

      <section className="card p-5">
        <p className="section-title">レベル別進捗</p>
        <div className="mt-4 space-y-3">
          {levels.map((level) => {
            const done = prints.filter((p) => p.level === level && progress[p.id]?.status === "completed").length;
            return <ProgressBar key={level} label={levelNames[level]} value={done} max={100} />;
          })}
        </div>
      </section>

      <section className="card p-5">
        <p className="section-title">最近の学習結果</p>
        <div className="mt-3 space-y-3">
          {recent.length ? recent.map((item) => <SubmissionRow key={item.id} submission={item} onOpen={onOpenFeedback} />) : (
            <p className="text-sm font-bold text-slate-500">まだ提出がありません。今日の1枚から始めましょう。</p>
          )}
        </div>
      </section>
      <InstallPrompt />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-mist px-3 py-4">
      <p className="text-[11px] font-black text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-navy">{value}</p>
    </div>
  );
}

function ProgressBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = `${Math.round((value / max) * 100)}%`;
  return (
    <div>
      <div className="flex justify-between text-sm font-black">
        <span>{label}</span>
        <span className="text-navy">{value} / {max}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-navy" style={{ width }} />
      </div>
    </div>
  );
}

function PrintList({
  progress,
  favorites,
  onOpen,
  onToggleFavorite
}: {
  progress: Record<string, PrintProgress>;
  favorites: string[];
  onOpen: (print: PrintItem) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const [level, setLevel] = useState<Level>("Opinion");
  const levelPrints = prints.filter((item) => item.level === level);

  return (
    <div className="space-y-4 px-5 py-5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {levels.map((item) => (
          <button key={item} className={`rounded-full px-4 py-2 text-sm font-black ${item === level ? "bg-navy text-white" : "bg-white text-navy"}`} onClick={() => setLevel(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {levelPrints.map((print) => {
          const status = statusFor(print, progress);
          return (
            <article key={print.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-black text-navy">{print.code}</p>
                  <p className="text-xs font-black text-slate-500">{print.level} / {print.title}</p>
                </div>
                <button className="text-xl" onClick={() => onToggleFavorite(print.id)}>{favorites.includes(print.id) ? "★" : "☆"}</button>
              </div>
              <p className="mt-3 text-sm font-black leading-6">{print.topicJp}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="pill">{status === "completed" ? "完了" : status === "unlocked" ? "未完了" : "ロック中"}</span>
                <button className="secondary-button !px-4 !py-2" onClick={() => onOpen(print)} disabled={status === "locked"}>詳細</button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function PrintDetail({ print, onAnswer }: { print: PrintItem; onAnswer: () => void }) {
  const pdfHref = new URL(print.pdfUrl, window.location.origin).toString();

  function printPdf() {
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "1px";
    frame.style.height = "1px";
    frame.style.border = "0";
    frame.style.opacity = "0";
    frame.src = pdfHref;
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        window.print();
      }
      window.setTimeout(() => frame.remove(), 3000);
    };
    document.body.appendChild(frame);
  }

  return (
    <div className="space-y-4 px-5 py-5">
      <section className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-black text-navy">{print.code}</p>
            <p className="text-sm font-black text-slate-500">{print.level}</p>
          </div>
          <span className="pill">{print.wordCountMin}〜{print.wordCountMax}語</span>
        </div>
        <h2 className="mt-5 text-xl font-black">{print.title}</h2>
        <p className="mt-4 text-lg font-black leading-8">{print.topicJp}</p>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-600">{print.topicEn}</p>
      </section>
      <section className="card p-5">
        <p className="section-title">構成</p>
        <div className="mt-3 flex flex-wrap gap-2">{print.structure.map((item) => <span key={item} className="pill">{item}</span>)}</div>
        <p className="section-title mt-5">書く内容のポイント</p>
        <ul className="mt-3 space-y-2 text-sm font-bold text-slate-700">
          {print.tips.map((tip) => <li key={tip}>・ {tip}</li>)}
        </ul>
      </section>
      <div className="grid gap-3 sm:grid-cols-3">
        <button className="primary-button" onClick={onAnswer}>回答する</button>
        <a className="secondary-button text-center" href={pdfHref} target="_blank" rel="noopener noreferrer external">PDFを開く</a>
        <button className="secondary-button text-center" onClick={printPdf}>印刷する</button>
      </div>
    </div>
  );
}

function AnswerInput({
  print,
  initial,
  ownerId,
  initialImageDataUrl,
  onImageChange,
  onConfirm
}: {
  print: PrintItem;
  initial: string;
  ownerId?: string | null;
  initialImageDataUrl?: string;
  onImageChange: (imageDataUrl: string) => void;
  onConfirm: (answer: string) => void;
}) {
  const [answer, setAnswer] = useState(initial);
  const [imageDataUrl, setImageDataUrl] = useState(initialImageDataUrl ?? "");
  const [imageError, setImageError] = useState("");
  const words = countWords(answer);
  const inRange = words >= print.wordCountMin && words <= print.wordCountMax;

  async function handleImageFile(file?: File | null) {
    if (!file) return;
    setImageError("");
    try {
      const dataUrl = await fileToImageDataUrl(file);
      setImageDataUrl(dataUrl);
      onImageChange(dataUrl);
    } catch (caught) {
      setImageError(caught instanceof Error ? caught.message : "画像を読み込めませんでした。");
    }
  }

  return (
    <div className="space-y-4 px-5 py-5">
      <section className="card p-5">
        <p className="section-title">{print.code} / {print.level}</p>
        <p className="mt-3 text-lg font-black leading-8">{print.topicJp}</p>
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-mist p-3">
          <span className="text-sm font-black">語数: {words}</span>
          <span className={`text-sm font-black ${inRange ? "text-navy" : "text-amber-600"}`}>目安 {print.wordCountMin}〜{print.wordCountMax}語</span>
        </div>
      </section>
      <textarea
        className="min-h-[320px] w-full rounded-3xl border border-slate-200 bg-white p-4 text-base font-bold leading-8 outline-none focus:border-navy focus:ring-4 focus:ring-navy/10"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="ここに英作文を入力してください"
      />
      <section className="card p-5">
        <p className="section-title">プリントを撮影して提出</p>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-600">印刷したプリントに手書きした場合は、回答欄が大きく写るように撮影してください。AIが英文を読み取って添削します。</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="secondary-button block cursor-pointer text-center">
          写真を撮る
          <input
            className="hidden"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={async (event) => {
              await handleImageFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <label className="secondary-button block cursor-pointer text-center">
          画像を選ぶ
          <input
            className="hidden"
            type="file"
            accept="image/*"
            onChange={async (event) => {
              await handleImageFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        </div>
        {imageDataUrl && (
          <div className="mt-4">
            <img src={imageDataUrl} alt="提出するプリント写真" className="max-h-72 w-full rounded-2xl bg-mist object-contain" />
            <button
              className="mt-3 text-sm font-black text-red-600"
              type="button"
              onClick={() => {
                setImageDataUrl("");
                onImageChange("");
              }}
            >
              写真を削除
            </button>
          </div>
        )}
        {imageError && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-xs font-bold leading-5 text-red-700">{imageError}</p>}
      </section>
      <div className="grid grid-cols-2 gap-3">
        <button className="secondary-button" onClick={() => saveDraft(print.id, answer, ownerId)}>下書き保存</button>
        <button className="primary-button" onClick={() => onConfirm(answer)} disabled={!answer.trim() && !imageDataUrl}>提出確認へ</button>
      </div>
    </div>
  );
}

function ConfirmSubmit({
  print,
  answer,
  imageDataUrl,
  loading,
  error,
  onBack,
  onSubmit
}: {
  print: PrintItem;
  answer: string;
  imageDataUrl?: string;
  loading: boolean;
  error: string;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-4 px-5 py-5">
      <section className="card p-5">
        <p className="section-title">提出確認</p>
        <h2 className="mt-2 text-2xl font-black text-navy">{print.code}</h2>
        <p className="mt-2 text-sm font-black text-slate-500">{print.level} / {answer.trim() ? `${countWords(answer)}語` : "写真から読み取り"}</p>
        {answer.trim() && <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-mist p-4 text-sm font-bold leading-7">{answer}</p>}
        {!answer.trim() && imageDataUrl && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-bold text-slate-600">この写真から英文を読み取って添削します。</p>
            <img src={imageDataUrl} alt="提出するプリント写真" className="max-h-96 w-full rounded-2xl bg-mist object-contain" />
          </div>
        )}
      </section>
      <div className="grid grid-cols-2 gap-3">
        <button className="secondary-button" onClick={onBack}>戻って修正</button>
        <button className="primary-button" onClick={onSubmit} disabled={loading}>{loading ? "添削中..." : "AI添削を依頼"}</button>
      </div>
      {error && <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">{error}</p>}
    </div>
  );
}

function FeedbackView({ feedback, onResubmit }: { feedback: Feedback; onResubmit: () => void }) {
  const scores = [
    ["文法", feedback.grammarScore],
    ["語彙", feedback.vocabularyScore],
    ["論理", feedback.logicScore],
    ["構成", feedback.structureScore],
    ["一貫性", feedback.consistencyScore]
  ];
  return (
    <div className="space-y-4 px-5 py-5">
      <section className="card p-5 text-center">
        <p className="section-title">AI添削結果</p>
        <div className="mx-auto mt-4 grid h-32 w-32 place-items-center rounded-full border-[12px] border-navy/15 bg-white">
          <span className="text-4xl font-black text-navy">{feedback.totalScore}</span>
        </div>
        <p className="mt-2 text-sm font-black text-slate-500">100点満点スコア</p>
      </section>
      <section className="card p-5">
        <p className="section-title">弱点分析</p>
        <div className="mt-4 space-y-3">{scores.map(([label, value]) => <ProgressBar key={label} label={label as string} value={value as number} max={100} />)}</div>
      </section>
      <ResultBlock title="良かった点" items={feedback.goodPoints} />
      <ResultBlock title="改善ポイント" items={feedback.improvementPoints} />
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

function ResultBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="card p-5">
      <p className="section-title">{title}</p>
      <ul className="mt-3 space-y-2 text-sm font-bold leading-7 text-slate-700">{items.map((item) => <li key={item}>□ {item}</li>)}</ul>
    </section>
  );
}

function History({ submissions, onOpenFeedback }: { submissions: Submission[]; onOpenFeedback: (submission: Submission) => void }) {
  const [level, setLevel] = useState<Level | "すべて">("すべて");
  const filtered = submissions.filter((item) => {
    const print = prints.find((p) => p.id === item.printId);
    return level === "すべて" || print?.level === level;
  }).slice().reverse();
  return (
    <div className="space-y-4 px-5 py-5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["すべて", ...levels] as const).map((item) => (
          <button key={item} className={`rounded-full px-4 py-2 text-sm font-black ${item === level ? "bg-navy text-white" : "bg-white text-navy"}`} onClick={() => setLevel(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="space-y-3">{filtered.map((item) => <SubmissionRow key={item.id} submission={item} onOpen={onOpenFeedback} />)}</div>
    </div>
  );
}

function SubmissionRow({ submission, onOpen }: { submission: Submission; onOpen?: (submission: Submission) => void }) {
  const print = prints.find((item) => item.id === submission.printId);
  const canOpen = Boolean(onOpen && submission.feedback);
  return (
    <article
      className={`card p-4 ${canOpen ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-lg" : ""}`}
      role={canOpen ? "button" : undefined}
      tabIndex={canOpen ? 0 : undefined}
      onClick={() => canOpen && onOpen?.(submission)}
      onKeyDown={(event) => {
        if (canOpen && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen?.(submission);
        }
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-black text-navy">{print?.code ?? submission.printId} / {print?.level}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{new Date(submission.createdAt).toLocaleString("ja-JP")}</p>
        </div>
        <span className="rounded-full bg-navy px-3 py-1 text-sm font-black text-white">{submission.feedback?.totalScore ?? "-"}点</span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm font-bold leading-6">{print?.topicJp}</p>
    </article>
  );
}

function Analytics({ submissions, progress }: { submissions: Submission[]; progress: Record<string, PrintProgress> }) {
  const completed = Object.values(progress).filter((item) => item.status === "completed").length;
  const scoreItems = submissions.map((item) => item.feedback).filter(Boolean) as Feedback[];
  const weakness = [
    ["文法", avg(scoreItems.map((f) => f.grammarScore))],
    ["語彙", avg(scoreItems.map((f) => f.vocabularyScore))],
    ["論理展開", avg(scoreItems.map((f) => f.logicScore))],
    ["構成", avg(scoreItems.map((f) => f.structureScore))],
    ["内容の一貫性", avg(scoreItems.map((f) => f.consistencyScore))]
  ];
  return (
    <div className="space-y-4 px-5 py-5">
      <section className="card grid grid-cols-3 gap-3 p-5 text-center">
        <Metric label="完了" value={`${completed}`} />
        <Metric label="平均" value={`${averageScore(submissions)}点`} />
        <Metric label="提出" value={`${submissions.length}`} />
      </section>
      <section className="card p-5">
        <p className="section-title">レベル別進捗</p>
        <div className="mt-4 space-y-3">{levels.map((level) => {
          const done = prints.filter((p) => p.level === level && progress[p.id]?.status === "completed").length;
          return <ProgressBar key={level} label={level} value={done} max={100} />;
        })}</div>
      </section>
      <section className="card p-5">
        <p className="section-title">弱点分析</p>
        <div className="mt-4 space-y-3">{weakness.map(([label, value]) => <ProgressBar key={label as string} label={label as string} value={value as number} max={100} />)}</div>
      </section>
    </div>
  );
}

function Profile({ profile, favorites, onLogout, onAdmin }: { profile: UserProfile; favorites: string[]; onLogout: () => void; onAdmin: () => void }) {
  return (
    <div className="space-y-4 px-5 py-5">
      <section className="card p-5">
        <p className="section-title">マイページ</p>
        <h2 className="mt-3 text-2xl font-black text-navy">{profile.displayName}</h2>
        <p className="mt-1 text-sm font-bold text-slate-500">{profile.email}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Metric label="契約プラン" value={profile.subscriptionPlan} />
          <Metric label="お気に入り" value={`${favorites.length}`} />
        </div>
      </section>
      <section className="card p-5">
        <p className="section-title">通知設定</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-black">Push通知</span>
          <button className="secondary-button !py-2">ON / OFF</button>
        </div>
        <input className="input mt-3 max-w-[180px]" type="time" defaultValue="20:00" />
      </section>
      <section className="card p-5">
        <p className="section-title">サブスクリプション</p>
        <div className="mt-3 grid gap-3">
          {["Free: 月3回までAI添削", "Premium: 月100回・全プリント", "Pro: 月300回・高度な分析"].map((plan) => <div key={plan} className="rounded-2xl bg-mist p-3 text-sm font-black">{plan}</div>)}
        </div>
      </section>
      <div className={`grid gap-3 ${profile.isAdmin ? "grid-cols-2" : "grid-cols-1"}`}>
        {profile.isAdmin && <button className="secondary-button" onClick={onAdmin}>管理画面</button>}
        <button className="primary-button" onClick={onLogout}>ログアウト</button>
      </div>
    </div>
  );
}

function Admin({ stats }: { stats: AdminStats | null }) {
  return (
    <div className="space-y-4 px-5 py-5">
      <section className="card p-5">
        <p className="section-title">簡易管理画面</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Metric label="ユーザー" value={`${stats?.users ?? "-"}`} />
          <Metric label="プリント" value="400" />
          <Metric label="提出" value={`${stats?.submissions ?? "-"}`} />
          <Metric label="AI使用" value={`${stats?.aiUsage ?? "-"}`} />
        </div>
      </section>
      <section className="card p-5">
        <p className="section-title">管理機能</p>
        <ul className="mt-3 space-y-2 text-sm font-bold text-slate-700">
          <li>□ ユーザー一覧</li>
          <li>□ プリント作成 / 編集 / 公開停止</li>
          <li>□ 提出一覧と添削履歴</li>
          <li>□ AI使用量確認</li>
          <li>□ サブスク状態確認</li>
        </ul>
      </section>
    </div>
  );
}

export default function App() {
  const storedProfile = canUseSupabaseAuth() ? null : getProfile();
  const [profile, setProfile] = useState<UserProfile | null>(() => storedProfile);
  const [authLoading, setAuthLoading] = useState(() => canUseSupabaseAuth());
  const [view, setView] = useState<View>("home");
  const [viewHistory, setViewHistory] = useState<View[]>([]);
  const [selectedCode, setSelectedCode] = useState("O-1");
  const [answer, setAnswer] = useState("");
  const [answerImageDataUrl, setAnswerImageDataUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>(() => getSubmissions(storedProfile?.id));
  const [progress, setProgress] = useState<Record<string, PrintProgress>>(() => initialProgress(storedProfile?.id));
  const [favorites, setFavorites] = useState<string[]>(() => getFavorites(storedProfile?.id));
  const selected = useMemo(() => getPrintByCode(selectedCode) ?? prints[0], [selectedCode]);
  const selectedFeedback = (selectedSubmissionId
    ? submissions.find((item) => item.id === selectedSubmissionId)
    : submissions.slice().reverse().find((item) => item.printId === selected.id)
  )?.feedback;
  const selectedSubmission = selectedSubmissionId
    ? submissions.find((item) => item.id === selectedSubmissionId)
    : submissions.slice().reverse().find((item) => item.printId === selected.id);

  useEffect(() => {
    if (!canUseSupabaseAuth()) return;
    getCurrentProfile()
      .then((currentProfile) => {
        if (currentProfile) {
          saveProfile(currentProfile);
          setProfile(currentProfile);
        }
      })
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (!profile) return;
    const localSubmissions = getSubmissions(profile.id);
    const localProgress = initialProgress(profile.id);
    const localFavorites = getFavorites(profile.id);
    let cancelled = false;

    setSubmissions(localSubmissions);
    setProgress(localProgress);
    setFavorites(localFavorites);
    setAnswer("");
    setAnswerImageDataUrl("");
    setSelectedCode("O-1");
    setSelectedSubmissionId(null);

    if (canUseSupabaseAuth()) {
      loadCloudLearningState()
        .then((cloud) => {
          if (cancelled) return;
          const nextProgress = { ...initialProgress(profile.id), ...cloud.progress };
          setSubmissions(cloud.submissions);
          setProgress(nextProgress);
          setFavorites(cloud.favorites);
          saveSubmissions(cloud.submissions, profile.id);
          saveProgress(nextProgress, profile.id);
          saveFavorites(cloud.favorites, profile.id);
        })
        .catch((error) => {
          console.error("failed to load cloud learning state", error);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  if (authLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-mist px-5">
        <div className="card p-6 text-center">
          <p className="text-lg font-black text-navy">WriteOne</p>
          <p className="mt-2 text-sm font-bold text-slate-500">ログイン状態を確認しています...</p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return <Login onLogin={setProfile} />;
  }

  function navigate(target: View) {
    if (target === "admin" && !profile?.isAdmin) return;
    setViewHistory((history) => [...history, view]);
    setView(target);
  }

  function openAdmin() {
    if (!profile?.isAdmin) return;
    navigate("admin");
    loadAdminStats()
      .then(setAdminStats)
      .catch((error) => {
        console.error("failed to load admin stats", error);
      });
  }

  function openPrint(print: PrintItem, target: View = "detail") {
    setSelectedCode(print.code);
    setSelectedSubmissionId(null);
    setAnswer(getDrafts(profile?.id)[print.id] ?? "");
    setAnswerImageDataUrl("");
    navigate(target);
  }

  function openSubmissionFeedback(submission: Submission) {
    if (!submission.feedback) return;
    const print = prints.find((item) => item.id === submission.printId);
    if (print) setSelectedCode(print.code);
    setSelectedSubmissionId(submission.id);
    navigate("feedback");
  }

  function toggleFavorite(id: string) {
    const isFavorite = !favorites.includes(id);
    const next = isFavorite ? [...favorites, id] : favorites.filter((item) => item !== id);
    setFavorites(next);
    saveFavorites(next, profile?.id);
    const print = prints.find((item) => item.id === id);
    if (print && profile?.id) {
      setCloudFavorite(print, isFavorite, profile.id).catch((error) => {
        console.error("failed to sync favorite", error);
      });
    }
  }

  async function submitForFeedback() {
    setLoading(true);
    setSubmitError("");
    try {
      const { submission, feedback } = await gradeEssay(selected, answer, { imageDataUrl: answer.trim() ? undefined : answerImageDataUrl || undefined });
      const reviewed = { ...submission, printId: selected.id, status: "reviewed" as const, feedback };
      const nextSubmissions = [...submissions, reviewed];
      setSubmissions(nextSubmissions);
      saveSubmissions(nextSubmissions, profile?.id);
      clearDraft(selected.id, profile?.id);

      const nextProgress = {
        ...progress,
        [selected.id]: {
          printId: selected.id,
          status: "completed" as const,
          bestScore: Math.max(progress[selected.id]?.bestScore ?? 0, feedback.totalScore),
          completedAt: new Date().toISOString()
        }
      };
      const levelPrints = prints.filter((item) => item.level === selected.level);
      const currentIndex = levelPrints.findIndex((item) => item.id === selected.id);
      const nextPrintItem = levelPrints[currentIndex + 1];
      if (nextPrintItem && !nextProgress[nextPrintItem.id]) {
        nextProgress[nextPrintItem.id] = { printId: nextPrintItem.id, status: "unlocked" };
      }
      setProgress(nextProgress);
      saveProgress(nextProgress, profile?.id);
      if (profile?.id) {
        await upsertCloudProgress(selected, nextProgress[selected.id], profile.id);
        if (nextPrintItem && nextProgress[nextPrintItem.id]) {
          await upsertCloudProgress(nextPrintItem, nextProgress[nextPrintItem.id], profile.id);
        }
      }
      setSelectedSubmissionId(reviewed.id);
      navigate("feedback");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "AI添削に失敗しました。時間を置いて再度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await signOut();
    saveProfile(null);
    setSubmissions([]);
    setProgress(initialProgress(null));
      setFavorites([]);
      setAnswer("");
      setAnswerImageDataUrl("");
      setSelectedSubmissionId(null);
    setProfile(null);
  }

  function goBack() {
    const fallback: Partial<Record<View, View>> = {
      detail: "prints",
      answer: "detail",
      confirm: "answer",
      feedback: "detail",
      admin: "profile"
    };
    const previous = viewHistory[viewHistory.length - 1];
    setViewHistory((history) => history.slice(0, -1));
    setView(previous ?? fallback[view] ?? "home");
  }

  return (
    <div className="shell">
      <Header profile={profile} />
      <BackButton view={view} onBack={goBack} />
      <main className="mx-auto max-w-5xl">
        {view === "home" && <Home progress={progress} submissions={submissions} onOpen={openPrint} onOpenFeedback={openSubmissionFeedback} />}
        {view === "prints" && <PrintList progress={progress} favorites={favorites} onOpen={openPrint} onToggleFavorite={toggleFavorite} />}
        {view === "detail" && <PrintDetail print={selected} onAnswer={() => openPrint(selected, "answer")} />}
        {view === "answer" && <AnswerInput print={selected} initial={answer} ownerId={profile?.id} initialImageDataUrl={answerImageDataUrl} onImageChange={setAnswerImageDataUrl} onConfirm={(value) => { setAnswer(value); navigate("confirm"); }} />}
        {view === "confirm" && <ConfirmSubmit print={selected} answer={answer} imageDataUrl={answerImageDataUrl} loading={loading} error={submitError} onBack={() => navigate("answer")} onSubmit={submitForFeedback} />}
        {view === "feedback" && selectedFeedback && <FeedbackResult feedback={selectedFeedback} submission={selectedSubmission} onResubmit={() => navigate("answer")} />}
        {view === "history" && <History submissions={submissions} onOpenFeedback={openSubmissionFeedback} />}
        {view === "progress" && <Analytics submissions={submissions} progress={progress} />}
        {view === "profile" && <Profile profile={profile} favorites={favorites} onLogout={logout} onAdmin={openAdmin} />}
        {view === "admin" && profile.isAdmin && <Admin stats={adminStats} />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {navItems.map((item) => (
            <button key={item.view} className={`tab-button ${view === item.view ? "tab-button-active" : ""}`} onClick={() => { setViewHistory([]); setView(item.view); }}>
              <span className="tab-icon"><NavIcon name={item.icon} /></span>
              <span className="tab-label">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function averageScore(submissions: Submission[]) {
  return avg(submissions.map((item) => item.feedback?.totalScore ?? 0).filter(Boolean));
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
