import React, { useEffect, useState } from "react";
import {
  Shield,
  LogOut,
  Folder,
  FolderOpen,
  Search,
  Plus,
  X,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  FileText,
  Activity,
} from "lucide-react";
const API = window.location.hostname.endsWith(".pages.dev")
  ? ""
  : import.meta.env.VITE_API_URL || "";
const users = [
  "Hor Nalen",
  "Keo Sothea",
  "ET Samoul",
  "Leng Samnang",
  "Chan Dalen",
  "DomZzz",
];
const categories = [
  { key: "criminal", label: "ដីការព្រហ្មទណ្ឌ", color: "blue" },
  { key: "drugs", label: "ដីការគ្រឿងញៀន", color: "orange" },
];
const subs = [
  { key: "arrest", label: "ដីការចាប់ខ្លួន" },
  { key: "release", label: "ដីការដោះលែង" },
];
const localDateTime = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
const displayDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("km-KH", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";
const getError = (e) => e?.error || "មិនអាចភ្ជាប់ទៅ Server បាន";
async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw data;
  return data;
}
function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? "compact" : ""}`}>
      <div className="brand-mark">
        <img
          src="/police.png"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
        <Shield size={compact ? 27 : 42} />
      </div>
      <div>
        <strong>ការគ្រប់គ្រងដីការ</strong>
        <span>ប៉ុស្តិ៍មេមង</span>
      </div>
    </div>
  );
}
function Login({ onLogin }) {
  const [name, setName] = useState(users[0]);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(
        (
          await api("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, password }),
          })
        ).user,
      );
    } catch (e) {
      setError(getError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="login-page">
      <div className="login-glow" />
      <section className="login-panel">
        <Brand />
        <div className="login-copy">
          <span className="eyebrow">SECURE CASE ARCHIVE</span>
          <h1>ប្រព័ន្ធគ្រប់គ្រងដីការ</h1>
          <p>ចូលប្រើប្រាស់បណ្ណសារដីការរបស់ប៉ុស្តិ៍មេមង</p>
        </div>
        <form onSubmit={submit} className="form-stack">
          <label>
            អ្នកប្រើប្រាស់
            <select value={name} onChange={(e) => setName(e.target.value)}>
              {users.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
          <label>
            ពាក្យសម្ងាត់
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="បញ្ចូលពាក្យសម្ងាត់"
            />
          </label>
          {error && <div className="alert error">{error}</div>}
          <button className="primary full" disabled={busy}>
            {busy ? "កំពុងចូល..." : "ចូលប្រព័ន្ធ"} <ChevronRight size={18} />
          </button>
        </form>
        <small className="login-note">
          ប្រព័ន្ធផ្ទៃក្នុង • រាល់សកម្មភាពត្រូវបានកត់ត្រា
        </small>
      </section>
    </main>
  );
}
function ChangePassword({ user, onDone, firstLogin = false, onClose }) {
  const [form, setForm] = useState({
    oldPassword: firstLogin ? "123" : "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      onDone({ ...user, must_change_password: false });
    } catch (e) {
      setError(getError(e));
    } finally {
      setBusy(false);
    }
  };
    const content = (
      <section className={firstLogin ? "login-panel password-panel" : "modal password-modal"}>
      {!firstLogin && <button className="icon-btn close" onClick={onClose}><X /></button>}
        <Brand />
        <div className="login-copy">
          <span className="eyebrow">WELCOME, {user.name.toUpperCase()}</span>
          <h1>សូមប្តូរពាក្យសម្ងាត់</h1>
          <p>
            សម្រាប់សុវត្ថិភាព សូមបង្កើតពាក្យសម្ងាត់ថ្មីដែលមានយ៉ាងតិច ៦ តួអក្សរ។
          </p>
        </div>
        <form onSubmit={submit} className="form-stack">
          <label>
            ពាក្យសម្ងាត់ចាស់
            <input
              type="password"
              value={form.oldPassword}
              onChange={(e) =>
                setForm({ ...form, oldPassword: e.target.value })
              }
              required
            />
          </label>
          <label>
            ពាក្យសម្ងាត់ថ្មី
            <input
              type="password"
              minLength="6"
              value={form.newPassword}
              onChange={(e) =>
                setForm({ ...form, newPassword: e.target.value })
              }
              required
            />
          </label>
          <label>
            បញ្ជាក់ពាក្យសម្ងាត់ថ្មី
            <input
              type="password"
              minLength="6"
              value={form.confirmPassword}
              onChange={(e) =>
                setForm({ ...form, confirmPassword: e.target.value })
              }
              required
            />
          </label>
          {error && <div className="alert error">{error}</div>}
          <button className="primary full" disabled={busy}>
            {busy ? "កំពុងរក្សាទុក..." : "បញ្ជាក់"} <ChevronRight size={18} />
          </button>
        </form>
      </section>
  );
  return firstLogin ? <main className="login-page">{content}</main> : <div className="modal-backdrop">{content}</div>;
}
function FolderCards({ selected, setSelected, counts }) {
  return (
    <div className="folder-grid">
      {categories.map((cat) => (
        <section
          className={`folder-card ${cat.color} ${selected === cat.key ? "selected" : ""}`}
          key={cat.key}
        >
          <button
            className="folder-head"
            onClick={() => setSelected(selected === cat.key ? "all" : cat.key)}
          >
            <span className="folder-icon">
              <FolderOpen size={25} />
            </span>
            <span>
              <b>{cat.label}</b>
              <small>{counts[cat.key] || 0} ដីការ</small>
            </span>
            <ChevronRight size={19} />
          </button>
          <div className="subfolder-list">
            {subs.map((sub) => (
              <button
                className={selected === `${cat.key}:${sub.key}` ? "active" : ""}
                key={sub.key}
                onClick={() => setSelected(`${cat.key}:${sub.key}`)}
              >
                <Folder size={17} />
                {sub.label}
                <span>{counts[`${cat.key}:${sub.key}`] || 0}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
function RecordForm({ edit, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: edit?.name || "",
    category: edit?.category || "criminal",
    subcategory: edit?.subcategory || "arrest",
    caseDate: edit?.case_date?.slice(0, 16) || localDateTime(),
  });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const choose = (e) => {
    const chosen = [...e.target.files];
    if (
      chosen.some(
        (f) => !["image/jpeg", "image/png", "image/webp"].includes(f.type),
      )
    ) {
      setError("ប្រភេទឯកសារមិនត្រឹមត្រូវ");
      return;
    }
    if (chosen.some((f) => f.size > 10 * 1024 * 1024)) {
      setError("រូបភាពធំពេក");
      return;
    }
    if (chosen.length + files.length > 20) {
      setError("អាចបញ្ចូលបានត្រឹម ២០ រូបភាព");
      return;
    }
    setFiles([...files, ...chosen]);
  };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = await api(edit ? `/api/cases/${edit.id}` : "/api/cases", {
        method: edit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const id = edit ? edit.id : saved.id;
      if (files.length) {
        const fd = new FormData();
        files.forEach((f) => fd.append("images", f));
        await api(`/api/cases/${id}/images`, { method: "POST", body: fd });
      }
      onSaved();
    } catch (e) {
      setError(getError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <section className="modal form-modal">
        <button className="icon-btn close" onClick={onClose}>
          <X />
        </button>
        <div className="modal-title">
          <span className="section-icon">
            <FileText size={19} />
          </span>
          <div>
            <span className="eyebrow">CASE RECORD</span>
            <h2>{edit ? "កែប្រែដីការ" : "បញ្ចូលដីការថ្មី"}</h2>
          </div>
        </div>
        <form onSubmit={submit} className="form-stack">
          <label>
            ប្រភេទដីការ
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            ថតដីការ
            <select
              value={form.subcategory}
              onChange={(e) =>
                setForm({ ...form, subcategory: e.target.value })
              }
            >
              {subs.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            ឈ្មោះ
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="បញ្ចូលឈ្មោះជនពាក់ព័ន្ធ"
              required
            />
          </label>
          <label>
            កាលបរិច្ឆេទ និងពេលវេលា
            <input
              type="datetime-local"
              value={form.caseDate}
              onChange={(e) => setForm({ ...form, caseDate: e.target.value })}
              required
            />
          </label>
          <label>
            រូបភាព{" "}
            <span className="hint">
              JPG, PNG, WEBP • អតិបរមា ២០ រូប • ១០ MB/រូប
            </span>
            <div className="upload-box">
              <ImagePlus size={25} />
              <b>ចុចដើម្បីជ្រើសរើសរូបភាព</b>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={choose}
              />
            </div>
          </label>
          {files.length > 0 && (
            <div className="preview-grid">
              {files.map((f, i) => (
                <div className="preview" key={`${f.name}${i}`}>
                  <img src={URL.createObjectURL(f)} />
                  <button
                    type="button"
                    onClick={() =>
                      setFiles(files.filter((_, idx) => idx !== i))
                    }
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {error && <div className="alert error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>
              បោះបង់
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "កំពុងរក្សាទុក..." : "រក្សាទុក"}{" "}
              <ChevronRight size={17} />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function Lightbox({ image, images, onClose }) {
  const index = images.findIndex((x) => x.id === image.id);
  const [current, setCurrent] = useState(index);
  const [zoom, setZoom] = useState(1);
  const item = images[current];
  return (
    <div className="lightbox">
      <button className="icon-btn light-close" onClick={onClose}>
        <X />
      </button>
      <div className="zoom-tools">
        <button onClick={() => setZoom(Math.max(0.75, zoom - 0.25))}>-</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(Math.min(3, zoom + 0.25))}>+</button>
      </div>
      <button
        className="nav prev"
        disabled={current === 0}
        onClick={() => {
          setCurrent(current - 1);
          setZoom(1);
        }}
      >
        <ChevronLeft />
      </button>
      <img
        style={{ transform: `scale(${zoom})` }}
        src={`${API}${item.url}`}
        alt={item.original_name}
      />
      <button
        className="nav next"
        disabled={current === images.length - 1}
        onClick={() => {
          setCurrent(current + 1);
          setZoom(1);
        }}
      >
        <ChevronRight />
      </button>
      <span className="image-count">
        {current + 1} / {images.length}
      </span>
    </div>
  );
}
function Dashboard({ user, onLogout }) {
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState("all");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null);
    const [passwordModal, setPasswordModal] = useState(false);
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    try {
      setLoading(true);
      setCases(await api("/api/cases"));
    } catch (e) {
      setError(getError(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const filtered = cases.filter(
    (c) =>
      (selected === "all" ||
        selected === c.category ||
        selected === `${c.category}:${c.subcategory}`) &&
      c.name.toLowerCase().includes(query.toLowerCase()),
  );
  const counts = cases.reduce(
    (a, c) => ({
      ...a,
      [c.category]: (a[c.category] || 0) + 1,
      [`${c.category}:${c.subcategory}`]:
        (a[`${c.category}:${c.subcategory}`] || 0) + 1,
    }),
    {},
  );
  const remove = async (id) => {
    if (!confirm("តើអ្នកពិតជាចង់លុបដីការនេះមែនទេ?")) return;
    try {
      await api(`/api/cases/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(getError(e));
    }
  };
  const logout = async () => {
    await api("/api/logout", { method: "POST" });
    onLogout();
  };
  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand compact />
        <div className="top-actions">
          <span className="user-chip">
            <span className="avatar">{user.name[0]}</span>
            <span className="user-name">{user.name}</span>
          </span>
          <button className="logout" onClick={logout}>
            <LogOut size={17} /> <span>ចាកចេញ</span>
          </button>
          <button className="account-action" onClick={() => setPasswordModal(true)}>
            ប្តូរពាក្យសម្ងាត់
          </button>
        </div>
      </header>
      <main className="dashboard">
        <section className="welcome">
          <div>
            <span className="eyebrow">សួស្តី, {user.name}</span>
            <h1>ផ្ទាំងគ្រប់គ្រង</h1>
            <p>ស្វែងរក និងគ្រប់គ្រងបណ្ណសារដីការរបស់អ្នក</p>
          </div>
          <button className="primary add-btn" onClick={() => setModal("new")}>
            <Plus size={19} /> បញ្ចូលដីការថ្មី
          </button>
        </section>
        <section className="stats">
          <div>
            <span className="stat-icon navy">
              <FileText size={20} />
            </span>
            <small>ដីការសរុប</small>
            <strong>{cases.length}</strong>
          </div>
          <div>
            <span className="stat-icon blue">
              <Shield size={20} />
            </span>
            <small>ដីការព្រហ្មទណ្ឌ</small>
            <strong>{counts.criminal || 0}</strong>
          </div>
          <div>
            <span className="stat-icon orange">
              <Activity size={20} />
            </span>
            <small>ដីការគ្រឿងញៀន</small>
            <strong>{counts.drugs || 0}</strong>
          </div>
        </section>
        <FolderCards
          selected={selected}
          setSelected={setSelected}
          counts={counts}
        />
        <section className="records-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ARCHIVE</span>
              <h2>
                {selected === "all" ? "ដីការទាំងអស់" : "បណ្ណសារដែលបានជ្រើសរើស"}
              </h2>
            </div>
            <div className="search">
              <Search size={19} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ស្វែងរកតាមឈ្មោះ..."
              />
            </div>
          </div>
          {error && <div className="alert error">{error}</div>}
          {loading ? (
            <div className="empty">កំពុងស្វែងរក...</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <Folder size={36} />
              <b>មិនមានទិន្នន័យ</b>
              <span>សាកល្បងស្វែងរក ឬបញ្ចូលដីការថ្មី</span>
            </div>
          ) : (
            <div className="record-grid">
              {filtered.map((c) => (
                <article className="record-card" key={c.id}>
                  <div className="record-meta">
                    <span className={`tag ${c.category}`}>
                      {c.category_label}
                    </span>
                    <span className="dot">•</span>
                    <span>{c.subcategory_label}</span>
                    <span className="case-date">{displayDateTime(c.case_date || c.created_at)}</span>
                  </div>
                  <h3>{c.name}</h3>
                  <div className="gallery">
                    {c.images.map((img) => (
                      <button
                        key={img.id}
                        onClick={() =>
                          setView({ image: img, images: c.images })
                        }
                      >
                        <img src={`${API}${img.url}`} alt={c.name} />
                      </button>
                    ))}
                    {!c.images.length && (
                      <div className="no-image">គ្មានរូបភាព</div>
                    )}
                  </div>
                  <footer>
                    <span>{c.images.length} រូបភាព</span>
                    <div>
                      <button
                        className="card-action"
                        onClick={() => setModal(c)}
                      >
                        <Pencil size={15} />
                        កែប្រែ
                      </button>
                      <button
                        className="card-action danger-text"
                        onClick={() => remove(c.id)}
                      >
                        <Trash2 size={15} />
                        លុប
                      </button>
                    </div>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      {modal && (
        <RecordForm
          edit={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
      {passwordModal && (
        <ChangePassword
          user={user}
          onClose={() => setPasswordModal(false)}
          onDone={() => setPasswordModal(false)}
        />
      )}
      {view && <Lightbox {...view} onClose={() => setView(null)} />}
    </div>
  );
}
export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    api("/api/me")
      .then((d) => setUser(d.user))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);
  if (checking)
    return (
      <div className="splash">
        <Shield size={42} />
        <span>កំពុងផ្ទុក...</span>
      </div>
    );
  if (!user) return <Login onLogin={setUser} />;
  if (user.must_change_password)
    return <ChangePassword user={user} firstLogin onDone={setUser} />;
  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}
