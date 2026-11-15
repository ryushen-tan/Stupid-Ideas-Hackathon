import { Architecture } from './architecture';
import { AuthPanel } from './auth-panel';

export default function Home() {
  return (
    <main className="min-h-svh lg:grid lg:grid-cols-[1.18fr_1fr]">
      <section className="hero relative isolate overflow-hidden text-white">
        <Architecture />
        <header className="relative z-10 flex items-center justify-between px-7 py-7 md:px-11 md:py-9">
          <a href="/" aria-label="Entré home" className="wordmark">entré<span>.</span></a>
          <span className="micro text-white/80">A PRIVATE WORLD, OPEN TO YOU.</span>
        </header>
        <div className="hero-copy relative z-10 px-7 md:px-11">
          <div className="mb-6 flex items-center gap-3"><span className="h-px w-7 bg-white/70" /><span className="micro">GOOD THINGS ARE WORTH PROTECTING</span></div>
          <h1>Your world.<br />Only yours.</h1>
          <p className="mt-6 max-w-72 text-[15px] leading-relaxed text-white/80">A little peace of mind.<br />A whole new way in.</p>
        </div>
        <footer className="hero-footer relative z-10 flex items-end justify-between px-7 pb-7 md:px-11 md:pb-9">
          <div className="micro leading-5 text-white/70">THOUGHTFULLY DESIGNED.<br />PERSONALLY PROTECTED.</div>
          <span className="text-3xl font-light">↗</span>
        </footer>
      </section>
      <section className="panel flex min-h-svh flex-col bg-[#f7f7f2] px-7 md:px-14 xl:px-20">
        <header className="flex items-center justify-between py-8 text-[11px] text-[#6b716c]">
          <span className="flex items-center gap-2"><span className="status-dot" /> THE ENTRÉ EXPERIENCE</span>
          <span className="rounded-full border border-[#d8dcd5] px-3 py-1.5">SECURE ACCESS</span>
        </header>
        <div className="flex flex-1 items-center py-10"><AuthPanel /></div>
        <footer className="flex items-center justify-between gap-4 border-t border-[#dddfd7] py-6 text-[10px] text-[#777d77]">
          <span>© {new Date().getFullYear()} ENTRÉ STUDIO</span>
          <span>YOUR PRIVACY, PROTECTED.</span>
        </footer>
      </section>
    </main>
  );
}
