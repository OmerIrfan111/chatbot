"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ResponsiveContainer,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Download, MessageSquare, CheckCircle, TrendingUp, Activity, Coins, Hash } from "lucide-react";
import { adminLogin, fetchAdminStats, fetchGaps, fetchUsage, gapsExportUrl } from "@/lib/api";
import type { AdminStats, AdminUsage, GapItem } from "@/lib/types";

function LoginForm({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const token = await adminLogin(email, password);
      localStorage.setItem("admin_token", token);
      onLogin(token);
    } catch {
      setError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#EBEBEB] p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm bg-white rounded-2xl border border-[#E2E2E2] shadow-sm p-8"
      >
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-[#1A1A1A]">Admin Dashboard</h1>
          <p className="text-sm text-[#888888] mt-1">Sign in with your admin credentials</p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-[#E2E2E2] text-sm bg-[#FAFAFA] focus:outline-none focus:ring-2 focus:ring-[#6B3AC6]/20 focus:border-[#6B3AC6] transition-all"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-[#E2E2E2] text-sm bg-[#FAFAFA] focus:outline-none focus:ring-2 focus:ring-[#6B3AC6]/20 focus:border-[#6B3AC6] transition-all"
            required
          />
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-red-500"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-[#6B3AC6] text-white text-sm font-medium hover:bg-[#5B2DB8] transition-colors disabled:opacity-60"
          >
            {loading ? "Signing in" : "Sign in"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-2xl border border-[#E2E2E2] p-5 shadow-sm"
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-[#888888] uppercase tracking-wider">{label}</p>
        <div className="p-2 rounded-xl" style={{ background: `${color}15` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-semibold text-[#1A1A1A]">{value}</p>
      {sub && <p className="text-xs text-[#AAAAAA] mt-1">{sub}</p>}
    </motion.div>
  );
}

function GapTable({ gaps, token }: { gaps: GapItem[]; token: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E2E2] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F0F0]">
        <div>
          <h2 className="text-sm font-semibold text-[#1A1A1A]">Knowledge Gaps</h2>
          <p className="text-xs text-[#AAAAAA] mt-0.5">Unanswered or low-confidence questions</p>
        </div>
        <a
          href={`${gapsExportUrl()}?token=${token}`}
          download="gaps.csv"
          onClick={async (e) => {
            e.preventDefault();
            const res = await fetch(gapsExportUrl(), {
              headers: { Authorization: `Bearer ${token}` },
            });
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "gaps.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E2E2] text-xs font-medium text-[#555555] hover:bg-[#F8F8F8] transition-colors"
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </a>
      </div>
      {gaps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#AAAAAA]">
          <CheckCircle className="h-8 w-8 mb-2 text-emerald-400" />
          <p className="text-sm">No gaps detected - great coverage!</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#F0F0F0] bg-[#FAFAFA]">
                <th className="text-left px-5 py-3 text-xs font-medium text-[#888888]">Question</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#888888] w-28">Confidence</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#888888] w-24">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#888888] w-32">Date</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((g, i) => (
                <motion.tr
                  key={g.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className={`border-b border-[#F8F8F8] hover:bg-[#FAFAFA] transition-colors ${i === gaps.length - 1 ? "border-b-0" : ""}`}
                >
                  <td className="px-5 py-3 text-[#1A1A1A] max-w-xs truncate">{g.question}</td>
                  <td className="px-4 py-3">
                    {g.is_refusal ? (
                      <span className="text-[#AAAAAA] text-xs">-</span>
                    ) : (
                      <span
                        className="text-xs font-medium"
                        style={{
                          color: (g.confidence ?? 0) >= 0.85 ? "#16A34A"
                            : (g.confidence ?? 0) >= 0.70 ? "#D97706"
                            : "#DC2626",
                        }}
                      >
                        {Math.round((g.confidence ?? 0) * 100)}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border"
                      style={
                        g.is_refusal
                          ? { background: "#FEF2F2", color: "#DC2626", borderColor: "#FECACA" }
                          : { background: "#FFFBEB", color: "#D97706", borderColor: "#FDE68A" }
                      }
                    >
                      {g.is_refusal ? "No answer" : "Low confidence"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#AAAAAA]">
                    {new Date(g.created_at).toLocaleDateString()}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const CONFIDENCE_COLORS = { High: "#16A34A", Medium: "#D97706", Low: "#DC2626" };
const FEEDBACK_COLORS = ["#6B3AC6", "#E2E2E2"];

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [usage, setUsage] = useState<AdminUsage | null>(null);
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, u, g] = await Promise.all([
        fetchAdminStats(token),
        fetchUsage(token),
        fetchGaps(token),
      ]);
      setStats(s);
      setUsage(u);
      setGaps(g);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      if (msg.includes("401") || msg.includes("403")) onLogout();
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, onLogout]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EBEBEB]">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-2 w-2 rounded-full bg-[#6B3AC6]"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EBEBEB]">
        <div className="text-center">
          <p className="text-sm text-red-500 mb-3">{error}</p>
          <button onClick={load} className="text-sm text-[#6B3AC6] underline">Retry</button>
        </div>
      </div>
    );
  }

  const confDistData = stats ? [
    { name: "High", value: stats.confidence_distribution.high },
    { name: "Medium", value: stats.confidence_distribution.medium },
    { name: "Low", value: stats.confidence_distribution.low },
  ] : [];

  const feedbackData = stats && stats.feedback.total > 0 ? [
    { name: "Helpful", value: stats.feedback.thumbs_up },
    { name: "Not helpful", value: stats.feedback.thumbs_down },
  ] : [];

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <header className="bg-white border-b border-[#E2E2E2] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-[#1A1A1A]">Admin Dashboard</h1>
          <p className="text-xs text-[#AAAAAA]">AI Support Agent analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="text-xs text-[#6B3AC6] hover:underline"
          >
            Refresh
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E2E2] text-xs font-medium text-[#555555] hover:bg-[#F8F8F8] transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Questions today" value={stats?.questions_today ?? 0} icon={MessageSquare} color="#6B3AC6" />
          <StatCard label="Answer rate" value={`${Math.round((stats?.answer_rate ?? 0) * 100)}%`} sub="of questions answered" icon={CheckCircle} color="#16A34A" />
          <StatCard label="Avg confidence" value={`${Math.round((stats?.avg_confidence ?? 0) * 100)}%`} sub="on answered questions" icon={TrendingUp} color="#D97706" />
          <StatCard label="Total questions" value={stats?.total_questions ?? 0} icon={Activity} color="#0EA5E9" />
        </div>

        {/* Cost / usage (Phase 7) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total cost"
            value={`$${(usage?.cost_usd ?? 0).toFixed(4)}`}
            sub="estimated LLM spend"
            icon={Coins}
            color="#6B3AC6"
          />
          <StatCard
            label="Total tokens"
            value={(usage?.total_tokens ?? 0).toLocaleString()}
            sub="prompt + completion"
            icon={Hash}
            color="#0EA5E9"
          />
          <StatCard
            label="Prompt tokens"
            value={(usage?.prompt_tokens ?? 0).toLocaleString()}
            icon={Hash}
            color="#16A34A"
          />
          <StatCard
            label="Completion tokens"
            value={(usage?.completion_tokens ?? 0).toLocaleString()}
            icon={Hash}
            color="#D97706"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-white rounded-2xl border border-[#E2E2E2] shadow-sm p-5">
            <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">Questions per day</h2>
            {(stats?.daily_counts.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={stats!.daily_counts} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#AAAAAA" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#AAAAAA" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <RechartTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E2E2", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
                  />
                  <Line type="monotone" dataKey="count" stroke="#6B3AC6" strokeWidth={2} dot={{ r: 3, fill: "#6B3AC6" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[180px] text-xs text-[#AAAAAA]">No data yet</div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-[#E2E2E2] shadow-sm p-5">
            <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">Confidence breakdown</h2>
            {confDistData.some((d) => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={confDistData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#AAAAAA" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#AAAAAA" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <RechartTooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E2E2" }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {confDistData.map((entry) => (
                      <Cell key={entry.name} fill={CONFIDENCE_COLORS[entry.name as keyof typeof CONFIDENCE_COLORS]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[180px] text-xs text-[#AAAAAA]">No data yet</div>
            )}
          </div>
        </div>

        {(stats?.feedback.total ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-[#E2E2E2] shadow-sm p-5"
          >
            <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">User feedback</h2>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie
                    data={feedbackData}
                    cx="50%" cy="50%"
                    innerRadius={38} outerRadius={60}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {feedbackData.map((_, i) => (
                      <Cell key={i} fill={FEEDBACK_COLORS[i]} />
                    ))}
                  </Pie>
                  <RechartTooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E2E2" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#6B3AC6]" />
                  <span className="text-[#1A1A1A]">Helpful</span>
                  <span className="font-semibold ml-2">{stats!.feedback.thumbs_up}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#E2E2E2]" />
                  <span className="text-[#1A1A1A]">Not helpful</span>
                  <span className="font-semibold ml-2">{stats!.feedback.thumbs_down}</span>
                </div>
                <p className="text-xs text-[#AAAAAA] mt-1">
                  {Math.round((stats!.feedback.thumbs_up / stats!.feedback.total) * 100)}% satisfaction rate
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <GapTable gaps={gaps} token={token} />
      </main>
    </div>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("admin_token");
    if (stored) setToken(stored);
  }, []);

  const logout = () => {
    localStorage.removeItem("admin_token");
    setToken(null);
  };

  if (!token) {
    return <LoginForm onLogin={setToken} />;
  }

  return <Dashboard token={token} onLogout={logout} />;
}
