import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { Shield, Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import Globe from "../../components/ui/globe";
import ScrambleText from "../../components/ui/scramble-text";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });
  const navigate = useNavigate();

  // Auto-close toast notifications after 5 seconds
  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, visible: false }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const token = await user.getIdToken();
      localStorage.setItem("vyomops_token", token);
      localStorage.setItem("vyomops_uid", user.uid);
      
      navigate("/dashboard");
    } catch (err: any) {
      console.error(err);
      let errorMsg = "Failed process authentication.";
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/invalid-email") {
        errorMsg = "Invalid credentials. Please verify your email and password.";
      } else if (err.code === "auth/operation-not-allowed") {
        errorMsg = "Email/Password sign-in is not enabled. Please activate this in the Firebase Console or use Google sign-in below.";
      } else if (err.code === "auth/user-not-found") {
        errorMsg = "Account not found. Verify your credentials or sign up.";
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      setToast({ message: errorMsg, visible: true });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      // Store user metadata
      await setDoc(doc(db, "operators", user.uid), {
        uid: user.uid,
        displayName: user.displayName || "Operator",
        email: user.email,
        createdAt: new Date().toISOString(),
        clearanceLevel: "LEVEL_1",
        assignedRegion: "Global Radar Feed"
      }, { merge: true });

      const token = await user.getIdToken();
      localStorage.setItem("vyomops_token", token);
      localStorage.setItem("vyomops_uid", user.uid);
      
      navigate("/dashboard");
    } catch (err: any) {
      console.error(err);
      let errorMsg = "Google authentication failed. Please try again.";
      if (err.message) {
        errorMsg = err.message;
      }
      setToast({ message: errorMsg, visible: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] bg-gradient-to-br from-[#0a0a14] via-[#030303] to-[#030303] text-zinc-100 font-sans flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background radial atmosphere */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-blue-900/10 to-indigo-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-gradient-to-br from-indigo-950/10 to-blue-950/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main card panel - Designed cleanly like the landing sections */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-center z-10 relative">
        
        {/* Left Side: Authentication Panel */}
        <div className="col-span-1 lg:col-span-6 flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            {/* Elegant Header and Subtitle */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/5 border border-blue-500/15 text-[10px] uppercase font-medium tracking-widest text-blue-400">
                <Shield className="w-3 h-3 text-blue-400" />
                <span>SECURED COMMAND ACCESS</span>
              </div>
              <h1 className="text-3xl font-orbitron font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-300 uppercase">
                <ScrambleText text="VyomOps Control" speed={60} />
              </h1>
              <p className="text-sm text-zinc-400 font-light leading-relaxed max-w-sm">
                Access your regional satellite feeds, pixel-delta intelligence, and overpass schedules in real time.
              </p>
            </div>

            {/* Premium, Warm-Slate Container Form */}
            <div className="p-8 sm:p-10 bg-zinc-900/20 backdrop-blur-md rounded-2xl border border-zinc-800/80 shadow-xl space-y-6 relative overflow-hidden">
              <form onSubmit={handleLogin} className="space-y-5">
                
                {/* Email Address */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                    Operator Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="name@agency.gov"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0a0a14]/60 hover:bg-[#0f0f1c]/60 focus:bg-[#0f0f1c]/80 border border-zinc-800 focus:border-blue-500/50 rounded-xl text-sm transition-all text-white font-sans focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                  />
                </div>

                {/* Password Input */}
                <div className="space-y-1.5 relative">
                  <div className="flex justify-between items-center">
                    <label htmlFor="password" className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                      Access Key
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-4 pr-12 py-3 bg-[#0a0a14]/60 hover:bg-[#0f0f1c]/60 focus:bg-[#0f0f1c]/80 border border-zinc-800 focus:border-blue-500/50 rounded-xl text-sm transition-all text-white font-sans focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs uppercase tracking-wider py-3.5 rounded-xl transition-all duration-300 shadow-md shadow-blue-600/10 hover:shadow-lg hover:shadow-blue-600/20 active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        <span>ESTABLISHING CONNECTION...</span>
                      </>
                    ) : (
                      <>
                        <span>DECRYPT & SECURE ACCESS</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-zinc-800" />
                  <span className="flex-shrink mx-3 text-[10px] font-sans text-zinc-500 uppercase tracking-widest font-bold">OR</span>
                  <div className="flex-grow border-t border-zinc-800" />
                </div>

                {/* Google Authentication */}
                <div>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-zinc-950/40 hover:bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700/80 text-zinc-200 font-semibold text-xs uppercase tracking-wider py-3.5 rounded-xl transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span>SIGN IN WITH GOOGLE</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Form actions footers */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 w-full max-w-[440px] mx-auto lg:ml-0 text-sm">
              <Link to="/register" className="text-xs text-zinc-400 hover:text-blue-400 transition-colors">
                New to VyomOps? <span className="text-blue-500 hover:underline font-semibold">Request Terminal Enrollment &rarr;</span>
              </Link>
              <Link to="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                &larr; Back to Radar
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Right Side: Rotating Earth Globe Preview */}
        <div className="col-span-1 lg:col-span-6 hidden lg:flex flex-col items-center justify-center relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="w-full relative aspect-square flex items-center justify-center max-w-lg"
          >
            {/* Subtle atmosphere rings */}
            <div className="absolute inset-4 border border-zinc-800/40 rounded-full" />
            <div className="absolute inset-16 border border-dashed border-zinc-800/30 rounded-full animate-[spin_50s_linear_infinite]" />
            
            {/* Beautiful spinning Globe */}
            <div className="relative z-10 scale-95 filter drop-shadow-[0_0_30px_rgba(59,130,246,0.15)]">
              <Globe />
            </div>

            {/* Informative minimal features over globe */}
            <div className="absolute bottom-6 right-6 p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md text-[10px] space-y-1 shadow-lg max-w-[200px]">
              <div className="flex items-center gap-2 text-blue-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span>ACTIVE POLAR ORBITS</span>
              </div>
              <p className="text-zinc-400 font-light font-sans text-[11px] leading-normal leading-relaxed">
                Sentinel and Landsat TLE configurations loaded. Dynamic path coverage synced with regional targets.
              </p>
            </div>
          </motion.div>
        </div>

      </div>

      {/* Modern, high-trust Toast notifications */}
      {toast.visible && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-xl p-4 shadow-xl flex items-center gap-3.5 max-w-sm backdrop-blur-md animate-fade-in">
          <div className="w-2.5 h-2.5 bg-red-500 rounded-full shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-xs text-red-400 mb-0.5">Authentication Error</div>
            <div className="text-zinc-400 text-xs leading-normal">{toast.message}</div>
          </div>
          <button 
            aria-label="Close notification"
            onClick={() => setToast(prev => ({ ...prev, visible: false }))} 
            className="text-zinc-500 hover:text-zinc-200 font-bold ml-2 shrink-0 cursor-pointer text-base leading-none"
          >
            &times;
          </button>
        </div>
      )}

    </div>
  );
}
