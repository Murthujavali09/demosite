/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  fetchScriptDetail,
  fetchScripts,
  runScript as executeScript,
  type ArtifactInfo,
  type ScriptDiscoveryWarning,
  type ScriptMeta,
} from "./lib/automationApi";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  Shield,
  ArrowRight,
  LogOut,
  CheckCircle2,
  User as UserIcon,
  Play,
  Sparkles,
  Database,
  FileText,
  MessageSquare,
  GitBranch,
  Terminal,
  Loader2,
  Cpu,
  Activity,
  Calendar,
  KeyRound,
  AlertCircle,
  Chrome,
  Camera,
  Code,
  Download
} from "lucide-react";

interface UserAccount {
  fullName: string;
  email: string;
  passwordHash: string; // Stored in plain text for this simple local persistence demo
  createdAt?: string; // date string
}

const SCRIPT_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  chrome: Chrome,
  terminal: Terminal,
  file: FileText,
  message: MessageSquare,
  git: GitBranch,
  database: Database,
  camera: Camera,
  code: Code,
};

function getScriptIcon(iconName: string) {
  return SCRIPT_ICONS[iconName] || Terminal;
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [isLogin, setIsLogin] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [currentUserDetails, setCurrentUserDetails] = useState<UserAccount | null>(null);

  // Automation running states
  const [automations, setAutomations] = useState<ScriptMeta[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const [scriptsError, setScriptsError] = useState("");
  const [scriptWarnings, setScriptWarnings] = useState<ScriptDiscoveryWarning[]>([]);
  const [scriptSources, setScriptSources] = useState<Record<string, string>>({});
  const [scriptSourceFiles, setScriptSourceFiles] = useState<Record<string, string>>({});
  const [runningStates, setRunningStates] = useState<Record<string, "idle" | "running" | "success">>({});
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [expandedCodeId, setExpandedCodeId] = useState<string | null>(null);
  const [artifactsByScript, setArtifactsByScript] = useState<Record<string, ArtifactInfo[]>>({});
  const [previewArtifact, setPreviewArtifact] = useState<ArtifactInfo | null>(null);

  // Placeholder actions feedback
  const [showPlaceholderFeedback, setShowPlaceholderFeedback] = useState(false);

  // Custom client-side router
  const navigate = (path: string) => {
    window.history.pushState(null, "", path);
    setCurrentPath(path);
  };

  // Synced state tracking
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Authentication persistence & session routing checks
  useEffect(() => {
    const activeSession = localStorage.getItem("auth_session");
    const activeSessionName = localStorage.getItem("auth_session_name");

    // Initialize user seed if not present
    const storedUsers = localStorage.getItem("auth_users");
    if (!storedUsers) {
      const defaultUsers: UserAccount[] = [
        {
          fullName: "Demo User",
          email: "user@example.com",
          passwordHash: "password123",
          createdAt: "June 20, 2026"
        }
      ];
      localStorage.setItem("auth_users", JSON.stringify(defaultUsers));
    }

    if (activeSession) {
      setCurrentUser(activeSession);
      setCurrentUserName(activeSessionName || activeSession);
      // Redirect to /dashboard if logged in but on root or login path
      if (currentPath === "/" || currentPath === "" || currentPath === "/login") {
        navigate("/dashboard");
      }
    } else {
      // Redirect to login if on protected routes but not logged in
      if (currentPath === "/dashboard" || currentPath === "/profile") {
        navigate("/login");
      }
    }
  }, [currentPath]);

  // Synchronize current user profile details
  useEffect(() => {
    if (currentUser) {
      const storedUsers = localStorage.getItem("auth_users");
      const usersList: UserAccount[] = storedUsers ? JSON.parse(storedUsers) : [];
      const matchedUser = usersList.find(
        (u) => u.email.toLowerCase() === currentUser.toLowerCase()
      );
      if (matchedUser) {
        setCurrentUserDetails(matchedUser);
      } else {
        // Fallback
        setCurrentUserDetails({
          fullName: currentUserName || "Active User",
          email: currentUser,
          passwordHash: "",
          createdAt: "June 28, 2026",
        });
      }
    } else {
      setCurrentUserDetails(null);
    }
  }, [currentUser, currentUserName]);

  useEffect(() => {
    if (!currentUser || currentPath !== "/dashboard") return;

    let cancelled = false;

    const loadScripts = async (showLoading = false) => {
      if (showLoading) {
        setScriptsLoading(true);
      }
      setScriptsError("");
      try {
        const { scripts, warnings = [] } = await fetchScripts();
        if (!cancelled) {
          setAutomations(scripts);
          setScriptWarnings(warnings);
        }
      } catch (err) {
        if (!cancelled) {
          setScriptsError(err instanceof Error ? err.message : "Failed to load scripts");
        }
      } finally {
        if (!cancelled && showLoading) {
          setScriptsLoading(false);
        }
      }
    };

    loadScripts(true);
    const refreshTimer = window.setInterval(() => loadScripts(), 5000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [currentUser, currentPath]);

  const toggleCodeSnippet = async (id: string) => {
    if (expandedCodeId === id) {
      setExpandedCodeId(null);
      return;
    }

    setExpandedCodeId(id);

    if (!scriptSources[id]) {
      try {
        const detail = await fetchScriptDetail(id);
        setScriptSources((prev) => ({ ...prev, [id]: detail.source }));
        setScriptSourceFiles((prev) => ({ ...prev, [id]: detail.sourceFile }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load script source";
        setScriptSources((prev) => ({ ...prev, [id]: `// ${message}` }));
        setScriptSourceFiles((prev) => ({ ...prev, [id]: "error.txt" }));
      }
    }
  };

  // Handle input actions
  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFullName(e.target.value);
    if (error) setError("");
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (error) setError("");
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (error) setError("");
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    if (error) setError("");
  };

  // Switch modes smoothly
  const toggleMode = () => {
    setIsLogin(!isLogin);
    setFullName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  // Auth processing
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const trimmedFullName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    // Validations
    if (!isLogin && !trimmedFullName) {
      setError("Full Name is required.");
      return;
    }

    if (!trimmedEmail) {
      setError("Email address is required.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!trimmedPassword) {
      setError("Password is required.");
      return;
    }
    if (trimmedPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (!isLogin) {
      if (!trimmedConfirmPassword) {
        setError("Please confirm your password.");
        return;
      }
      if (trimmedPassword !== trimmedConfirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setIsLoading(true);

    setTimeout(() => {
      const storedUsers = localStorage.getItem("auth_users");
      const usersList: UserAccount[] = storedUsers ? JSON.parse(storedUsers) : [];

      if (isLogin) {
        // LOGIN FLOW
        const matchedUser = usersList.find(
          (u) => u.email.toLowerCase() === trimmedEmail.toLowerCase()
        );

        if (!matchedUser) {
          setError("No account found with this email. Please sign up.");
          setIsLoading(false);
          return;
        }

        if (matchedUser.passwordHash !== trimmedPassword) {
          setError("Incorrect password. Please try again.");
          setIsLoading(false);
          return;
        }

        // Save session & navigate
        localStorage.setItem("auth_session", matchedUser.email);
        localStorage.setItem("auth_session_name", matchedUser.fullName);
        setCurrentUser(matchedUser.email);
        setCurrentUserName(matchedUser.fullName);
        setSuccess("Login successful!");
        setIsLoading(false);
        navigate("/dashboard");
      } else {
        // SIGNUP FLOW
        const userExists = usersList.some(
          (u) => u.email.toLowerCase() === trimmedEmail.toLowerCase()
        );

        if (userExists) {
          setError("An account with this email already exists. Please log in.");
          setIsLoading(false);
          return;
        }

        const newUser: UserAccount = {
          fullName: trimmedFullName,
          email: trimmedEmail,
          passwordHash: trimmedPassword,
          createdAt: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        };
        const updatedUsers = [...usersList, newUser];
        localStorage.setItem("auth_users", JSON.stringify(updatedUsers));

        localStorage.setItem("auth_session", newUser.email);
        localStorage.setItem("auth_session_name", newUser.fullName);
        setCurrentUser(newUser.email);
        setCurrentUserName(newUser.fullName);
        setSuccess("Account created successfully!");
        setIsLoading(false);
        navigate("/dashboard");
      }
    }, 750);
  };

  // Sign out handler
  const handleLogout = () => {
    localStorage.removeItem("auth_session");
    localStorage.removeItem("auth_session_name");
    setCurrentUser(null);
    setCurrentUserName(null);
    setFullName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
    navigate("/login");
  };

  // Automation execution via backend API
  const runAutomation = async (id: string, name: string) => {
    if (runningStates[id] === "running") return;

    setRunningStates((prev) => ({ ...prev, [id]: "running" }));

    const startTime = new Date().toLocaleTimeString();
    setExecutionLogs((prev) => [
      `[${startTime}] Starting: ${name}...`,
      ...prev,
    ]);

    try {
      await executeScript(id, {
        onLog: (message) => {
          const logTime = new Date().toLocaleTimeString();
          setExecutionLogs((prev) => [`[${logTime}] ${message}`, ...prev]);
        },
        onComplete: (result) => {
          const endTime = new Date().toLocaleTimeString();

          if (result.success) {
            setArtifactsByScript((prev) => ({ ...prev, [id]: result.artifacts }));
            setExecutionLogs((prev) => [
              `[${endTime}] SUCCESS: ${name} completed with ${result.artifacts.length} artifact(s).`,
              ...prev,
            ]);
            setRunningStates((prev) => ({ ...prev, [id]: "success" }));
          } else {
            setExecutionLogs((prev) => [
              `[${endTime}] FAILED: ${result.error || "Script execution failed"}`,
              ...prev,
            ]);
            setRunningStates((prev) => ({ ...prev, [id]: "idle" }));
          }

          setTimeout(() => {
            setRunningStates((prev) => ({ ...prev, [id]: "idle" }));
          }, 4000);
        },
      });
    } catch (err) {
      const endTime = new Date().toLocaleTimeString();
      const message = err instanceof Error ? err.message : "Failed to run script";
      setExecutionLogs((prev) => [
        `[${endTime}] ERROR: ${message}`,
        ...prev,
      ]);
      setRunningStates((prev) => ({ ...prev, [id]: "idle" }));
    }
  };

  const downloadArtifact = (artifact: ArtifactInfo) => {
    const link = document.createElement("a");
    link.href = artifact.url;
    link.download = artifact.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Shared responsive navigation header bar
  const renderNavBar = () => {
    return (
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        {/* Left Side Brand */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 rounded-xl text-white">
            <Cpu size={22} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-base leading-tight">AgileEngine Portal</h2>
            <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">DevOps Agent Console</p>
          </div>
        </div>

        {/* Center Links (Dashboard & Profile) */}
        <div className="flex items-center gap-1.5 border-y md:border-y-0 py-2 md:py-0 border-slate-100 justify-center md:justify-start">
          <button
            onClick={() => navigate("/dashboard")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              currentPath === "/dashboard"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Activity size={16} />
            <span>Dashboard</span>
          </button>
          
          <button
            onClick={() => navigate("/profile")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              currentPath === "/profile"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <UserIcon size={16} />
            <span>Profile</span>
          </button>
        </div>

        {/* Right Side Session & Logout */}
        <div className="flex items-center justify-between md:justify-end gap-4">
          <button
            id="btn-logout"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50/50 border border-slate-200 hover:border-rose-100 transition-all text-xs font-bold cursor-pointer"
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      <AnimatePresence mode="wait">
        {currentUser && currentPath === "/dashboard" ? (
          /* DASHBOARD VIEW */
          <motion.div
            key="dashboard-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-6xl mx-auto px-4 py-8 md:py-12 flex-grow flex flex-col gap-8"
          >
            {/* Shared Header Navigation */}
            {renderNavBar()}

            {/* Main Welcome Area */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 md:p-8 text-white relative overflow-hidden shadow-md">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Activity size={180} strokeWidth={1} />
              </div>

              <div className="relative z-10 max-w-xl">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                  Welcome back, {currentUserName} 👋
                </h1>
              </div>
            </div>

            {/* Dashboard Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              {/* Left Column: Automation Cards */}
              <div className="lg:col-span-2 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <span>Available Automations</span>
                    <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-0.5 rounded-full font-bold">
                      {automations.length}
                    </span>
                  </h3>
                  <div className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>{scriptsLoading ? "Loading scripts..." : "Systems Operational"}</span>
                  </div>
                </div>

                {scriptsError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                    {scriptsError}. Make sure the API server is running (`npm run dev`).
                  </div>
                )}

                {scriptWarnings.length > 0 && !scriptsError && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 space-y-1">
                    <p className="font-semibold">Some script folders were skipped:</p>
                    {scriptWarnings.map((warning) => (
                      <p key={warning.folder}>
                        <span className="font-mono">{warning.folder}</span>: {warning.message}
                      </p>
                    ))}
                  </div>
                )}

                {!scriptsLoading && automations.length === 0 && !scriptsError && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
                    <p className="text-sm font-semibold text-slate-700">No scripts found</p>
                    <p className="text-xs text-slate-500 mt-2">
                      Add a folder under <span className="font-mono">scripts/</span> with a{" "}
                      <span className="font-mono">script.json</span> and entry file.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {automations.map((auto) => {
                    const IconComp = getScriptIcon(auto.icon);
                    const runState = runningStates[auto.id] || "idle";
                    const artifacts = artifactsByScript[auto.id] || [];
                    const sourceCode = scriptSources[auto.id];
                    const sourceFile = scriptSourceFiles[auto.id] || auto.entry;

                    return (
                      <div
                        key={auto.id}
                        className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-xs transition-all duration-200 flex flex-col justify-between gap-5 relative group hover:shadow-md hover:shadow-slate-100"
                      >
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono">
                              {auto.category}
                            </span>

                            {/* Status badge */}
                            {runState === "idle" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 border border-emerald-100 text-emerald-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Available
                              </span>
                            )}
                            {runState === "running" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 border border-blue-100 text-blue-700">
                                <Loader2 size={10} className="animate-spin text-blue-500" />
                                Running
                              </span>
                            )}
                            {runState === "success" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500 text-white">
                                <Check size={11} strokeWidth={3} />
                                Completed
                              </span>
                            )}
                          </div>

                          <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 group-hover:bg-slate-900 group-hover:text-white transition-all">
                              <IconComp size={20} />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800 text-sm group-hover:text-slate-900">
                                {auto.name}
                              </h4>
                              <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                                {auto.description}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Action footer */}
                        <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
                          <button
                            onClick={() => toggleCodeSnippet(auto.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all cursor-pointer"
                          >
                            <Code size={13} />
                            <span>{expandedCodeId === auto.id ? "Hide Code" : "Code Snippet"}</span>
                          </button>

                          <button
                            onClick={() => runAutomation(auto.id, auto.name)}
                            disabled={runState === "running"}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all select-none cursor-pointer ${
                              runState === "running"
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                : runState === "success"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-900 hover:bg-slate-800 text-white shadow-xs active:scale-95"
                            }`}
                          >
                            {runState === "running" ? (
                              <>
                                <Loader2 size={13} className="animate-spin" />
                                <span>Running...</span>
                              </>
                            ) : runState === "success" ? (
                              <>
                                <Check size={13} />
                                <span>Triggered</span>
                              </>
                            ) : (
                              <>
                                <Play size={11} fill="currentColor" />
                                <span>Run Task</span>
                              </>
                            )}
                          </button>
                        </div>

                        {artifacts.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {artifacts.map((artifact) => (
                              <button
                                key={artifact.url}
                                onClick={() =>
                                  artifact.mimeType.startsWith("image/")
                                    ? setPreviewArtifact(artifact)
                                    : downloadArtifact(artifact)
                                }
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                              >
                                <Download size={11} />
                                <span>{artifact.name}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Collapsible code snippet */}
                        <AnimatePresence initial={false}>
                          {expandedCodeId === auto.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-900 text-[10px] text-emerald-400 font-mono overflow-x-auto max-h-60 leading-relaxed scrollbar-thin">
                                <div className="text-slate-500 border-b border-slate-900 pb-1.5 mb-1.5 flex items-center justify-between">
                                  <span>{sourceFile}</span>
                                  <span className="text-[9px] uppercase">{auto.runner}</span>
                                </div>
                                {sourceCode || "Loading source..."}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Simulated Terminal / Activity Monitor */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <Terminal size={16} className="text-slate-500" />
                    <span>Routines Activity Log</span>
                  </h3>
                  {executionLogs.length > 0 && (
                    <button
                      onClick={() => setExecutionLogs([])}
                      className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                    >
                      Clear Logs
                    </button>
                  )}
                </div>

                <div className="bg-slate-950 text-slate-200 rounded-2xl p-5 font-mono text-[11px] shadow-lg border border-slate-900 min-h-[280px] max-h-[360px] overflow-y-auto flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-slate-500 border-b border-slate-900 pb-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="font-bold">AGILE_AUTOMATION_HOST_TTY</span>
                    </div>

                    {executionLogs.length === 0 ? (
                      <p className="text-slate-600 italic">No tasks executed in this session. Trigger an automation to monitor output streams...</p>
                    ) : (
                      <div className="space-y-1.5">
                        {executionLogs.map((log, index) => (
                          <div
                            key={index}
                            className={`leading-relaxed ${
                              log.includes("SUCCESS")
                                ? "text-emerald-400 font-bold"
                                : log.includes("FAILED") || log.includes("ERROR")
                                ? "text-rose-400 font-bold"
                                : "text-slate-300"
                            }`}
                          >
                            {log}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-slate-600 text-[10px] pt-4 mt-4 border-t border-slate-900/50 flex justify-between">
                    <span>Host Node: active_01</span>
                    <span>TTY: ready</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : currentUser && currentPath === "/profile" ? (
          /* PROFILE VIEW */
          <motion.div
            key="profile-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-6xl mx-auto px-4 py-8 md:py-12 flex-grow flex flex-col gap-8"
          >
            {/* Shared Header Navigation */}
            {renderNavBar()}

            {/* Profile Page Content */}
            <div className="max-w-2xl mx-auto w-full">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Your Account Profile</h1>
                <p className="text-slate-500 text-sm mt-1">Review your agile testing account configuration parameters and metadata.</p>
              </div>

              {/* Placeholder notification toast feedback */}
              <AnimatePresence>
                {showPlaceholderFeedback && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-start gap-3"
                  >
                    <AlertCircle size={18} className="shrink-0 text-amber-600" />
                    <div>
                      <p className="font-bold">Action Placeholder</p>
                      <p className="text-amber-700/80 font-medium mt-0.5">Password modification sequence is currently simulation-only for this validation cycle.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Profile Card */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-slate-900 p-6 md:p-8 text-white flex flex-col sm:flex-row items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-white shadow-inner">
                    <UserIcon size={32} strokeWidth={1.5} />
                  </div>
                  <div className="text-center sm:text-left">
                    <h2 className="text-xl font-bold tracking-tight">{currentUserDetails?.fullName || "Active User"}</h2>
                    <p className="text-slate-300 text-xs mt-1 font-mono bg-white/10 px-2 py-0.5 rounded-md inline-block">Registered Member</p>
                  </div>
                </div>

                {/* Info Fields Grid */}
                <div className="p-6 md:p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</p>
                      <div className="flex items-center gap-2.5 text-sm text-slate-800 font-semibold p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                        <UserIcon size={16} className="text-slate-400" />
                        <span>{currentUserDetails?.fullName || "Not Specified"}</span>
                      </div>
                    </div>

                    {/* Email Address */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</p>
                      <div className="flex items-center gap-2.5 text-sm text-slate-800 font-semibold p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                        <Mail size={16} className="text-slate-400" />
                        <span>{currentUserDetails?.email || "Not Specified"}</span>
                      </div>
                    </div>

                    {/* Account Created Date */}
                    <div className="space-y-1.5 md:col-span-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Created Date</p>
                      <div className="flex items-center gap-2.5 text-sm text-slate-800 font-semibold p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                        <Calendar size={16} className="text-slate-400" />
                        <span>{currentUserDetails?.createdAt || "June 28, 2026"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row gap-3 justify-end">
                    <button
                      onClick={() => {
                        setShowPlaceholderFeedback(true);
                        setTimeout(() => setShowPlaceholderFeedback(false), 5000);
                      }}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-semibold cursor-pointer"
                    >
                      <KeyRound size={16} className="text-slate-400" />
                      <span>Change Password</span>
                    </button>

                    <button
                      onClick={handleLogout}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all text-sm font-semibold cursor-pointer border border-rose-100"
                    >
                      <LogOut size={16} />
                      <span>Logout Account</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* AUTH PORTAL VIEW (For /, /login, or unauthenticated redirects) */
          <motion.div
            key="auth-portal-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-[420px] px-4 py-16 mx-auto flex-grow flex flex-col justify-center"
          >
            {/* Header Title */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs mb-4 text-slate-900">
                <Shield size={24} strokeWidth={1.5} className="text-slate-800" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-sans">
                {isLogin ? "Welcome back" : "Create an account"}
              </h1>
              <p className="text-slate-500 text-sm mt-1.5">
                {isLogin
                  ? "Enter your details below to log in"
                  : "Fill out the fields to sign up and start testing"}
              </p>
            </div>

            {/* Authentication Card */}
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-100 p-6 md:p-8 overflow-hidden"
            >
              {/* Alert Message */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs font-medium flex items-start gap-2.5"
                  >
                    <X size={16} className="shrink-0 mt-0.5 text-rose-500" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Full Name Field (Signup Only) */}
                <AnimatePresence initial={false}>
                  {!isLogin && (
                    <motion.div
                      key="name-field-container"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <label className="block text-xs font-medium text-slate-700 mb-1.5 font-sans" htmlFor="name-input">
                        Full Name
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <UserIcon size={16} />
                        </div>
                        <input
                          id="name-input"
                          type="text"
                          value={fullName}
                          onChange={handleFullNameChange}
                          placeholder="John Doe"
                          className="block w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-sans"
                          disabled={isLoading}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Email Field */}
                <motion.div layout transition={{ type: "spring", stiffness: 320, damping: 32 }}>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5 font-sans" htmlFor="email-input">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail size={16} />
                    </div>
                    <input
                      id="email-input"
                      type="email"
                      value={email}
                      onChange={handleEmailChange}
                      placeholder="you@example.com"
                      className="block w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-sans"
                      disabled={isLoading}
                    />
                  </div>
                </motion.div>

                {/* Password Field */}
                <motion.div layout transition={{ type: "spring", stiffness: 320, damping: 32 }}>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-medium text-slate-700 font-sans" htmlFor="password-input">
                      Password
                    </label>
                    {isLogin && (
                      <span className="text-[11px] text-slate-400 font-medium hover:text-slate-600 cursor-pointer select-none">
                        Forgot?
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock size={16} />
                    </div>
                    <input
                      id="password-input"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={handlePasswordChange}
                      placeholder="••••••••"
                      className="block w-full pl-10 pr-10 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-sans"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </motion.div>

                {/* Confirm Password Field (Signup Only) */}
                <AnimatePresence initial={false}>
                  {!isLogin && (
                    <motion.div
                      key="confirm-password-field-container"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <label className="block text-xs font-medium text-slate-700 mb-1.5 font-sans" htmlFor="confirm-password-input">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Lock size={16} />
                        </div>
                        <input
                          id="confirm-password-input"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={handleConfirmPasswordChange}
                          placeholder="••••••••"
                          className="block w-full pl-10 pr-10 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all font-sans"
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Password Strength Indicator for Signup */}
                <AnimatePresence initial={false}>
                  {!isLogin && password && (
                    <motion.div
                      key="strength-indicator"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="text-xs space-y-1.5 pt-1 overflow-hidden"
                    >
                      <div className="flex gap-1.5 h-1">
                        <div className={`h-full flex-1 rounded-full ${password.length >= 6 ? 'bg-emerald-500' : 'bg-rose-400'}`}></div>
                        <div className={`h-full flex-1 rounded-full ${password.length >= 8 ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                        <div className={`h-full flex-1 rounded-full ${password.length >= 10 && /[A-Z]/.test(password) ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                        <span>Strength</span>
                        <span>
                          {password.length < 6
                            ? "Too short (min 6)"
                            : password.length < 8
                            ? "Good"
                            : "Strong"}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit Button */}
                <motion.button
                  id="btn-submit"
                  type="submit"
                  disabled={isLoading}
                  layout
                  transition={{ type: "spring", stiffness: 320, damping: 32 }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 active:scale-[0.98] transition-all disabled:opacity-75 disabled:pointer-events-none shadow-sm mt-2 cursor-pointer font-sans"
                >
                  {isLoading ? (
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <>
                      <span>{isLogin ? "Log in" : "Sign up"}</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </motion.button>
              </form>

              {/* Mode Toggle Footer */}
              <motion.div
                layout
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                className="mt-6 text-center text-xs text-slate-500 border-t border-slate-100 pt-5"
              >
                {isLogin ? "New to the platform?" : "Already have an account?"}{" "}
                <button
                  id="btn-toggle-mode"
                  onClick={toggleMode}
                  className="font-medium text-slate-900 hover:underline hover:text-slate-800 transition-all cursor-pointer"
                >
                  {isLogin ? "Create an account" : "Sign in to existing account"}
                </button>
              </motion.div>
            </motion.div>

            {/* Helper Credentials Tip */}
            <AnimatePresence>
              {isLogin && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4 text-center text-[11px] text-slate-400 font-mono"
                >
                  Tip: Use <span className="text-slate-500">user@example.com</span> / <span className="text-slate-500">password123</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Artifact Preview Modal */}
      <AnimatePresence>
        {previewArtifact && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col"
            >
              <div className="bg-slate-900 text-slate-300 px-4 py-3.5 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                  <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                  <span className="text-xs text-slate-400 font-mono ml-3 select-none">
                    {previewArtifact.name}
                  </span>
                </div>
                <button
                  onClick={() => setPreviewArtifact(null)}
                  className="text-xs font-bold text-slate-400 hover:text-white transition-all px-2.5 py-1 rounded-md hover:bg-slate-800 cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto bg-slate-50 p-4">
                {previewArtifact.mimeType.startsWith("image/") ? (
                  <img
                    src={previewArtifact.url}
                    alt={previewArtifact.name}
                    className="w-full rounded-xl border border-slate-200 bg-white"
                  />
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                    Preview is not available for this file type. Use download instead.
                  </div>
                )}
              </div>

              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  onClick={() => setPreviewArtifact(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-all rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => downloadArtifact(previewArtifact)}
                  className="flex items-center gap-1.5 px-4.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  <Download size={13} />
                  <span>Download</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Shared Humble Workspace Footer */}
      <footer className="w-full text-center py-6 text-[11px] text-slate-400 font-mono border-t border-slate-200/50 bg-white">
        Agile Portal • Verified Session Engine
      </footer>
    </div>
  );
}
