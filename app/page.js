import Image from 'next/image'

export default function Home() {
  return (
    <main className="min-h-screen" style={{background: 'linear-gradient(135deg, #1a4a35 0%, #2D6A4F 50%, #1e5c42 100%)'}}>

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6">
        <Image 
          src="/logo.png" 
          alt="PSyllabus" 
          width={150} 
          height={50}
          priority
        />
        <a href="#waitlist" 
        className="text-[#E8D5B0] hover:text-white text-sm font-semibold 
        tracking-wide transition-colors border border-[#E8D5B0]/30 
        hover:border-[#E8D5B0] px-4 py-2 rounded-lg">
          Join waitlist →
        </a>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-16 pb-24">
        
        <div className="bg-[#E8D5B0]/15 border border-[#E8D5B0]/30 
        text-[#E8D5B0] text-xs font-bold px-5 py-2 rounded-full mb-10 
        tracking-widest uppercase">
          Built by an IB student · Launching 2026
        </div>

        <h1 className="text-white text-5xl sm:text-7xl font-extrabold 
        max-w-3xl leading-[1.1] mb-6 tracking-tight">
          Stop guessing.<br />
          <span style={{color: '#E8D5B0'}}>Start progressing.</span>
        </h1>

        <p className="text-white/75 text-xl max-w-xl leading-relaxed mb-16">
          PSyllabus maps your IB, A-Level, or AP syllabus topic by topic 
          and tells you exactly what to study today based on where 
          you're actually falling behind.
        </p>

        <div id="waitlist" 
        className="flex flex-col sm:flex-row gap-3 w-full max-w-md mb-5">
          <input
            type="email"
            placeholder="your@email.com"
            className="flex-1 px-5 py-4 rounded-xl font-medium 
            outline-none text-base border-2 border-white/20
            focus:border-[#E8D5B0] transition-colors"
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
            }}
          />
          <button 
          className="font-bold px-7 py-4 rounded-xl active:scale-95 
          transition-all text-base whitespace-nowrap text-[#1a4a35]"
          style={{background: 'linear-gradient(135deg, #E8D5B0 0%, #d4bc8e 100%)'}}>
            Get early access
          </button>
        </div>

        <p className="text-white/40 text-sm">
          Free during beta · No credit card needed · No spam
        </p>
      </section>

      {/* Stats bar */}
      <div className="border-t border-b border-white/10 py-8 px-6"
      style={{background: 'rgba(0,0,0,0.15)'}}>
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-white font-extrabold text-3xl mb-1">3</p>
            <p className="text-white/50 text-sm">Curriculums covered</p>
          </div>
          <div>
            <p className="text-white font-extrabold text-3xl mb-1">5,000+</p>
            <p className="text-white/50 text-sm">Syllabus topics mapped</p>
          </div>
          <div>
            <p className="text-white font-extrabold text-3xl mb-1">$0</p>
            <p className="text-white/50 text-sm">During beta</p>
          </div>
        </div>
      </div>

      {/* Problem */}
      <section className="px-6 py-24 max-w-3xl mx-auto">
        <p className="text-[#E8D5B0] text-xs font-bold tracking-widest 
        uppercase text-center mb-5">The Problem</p>
        <h2 className="text-white text-4xl font-bold text-center mb-8 leading-tight">
          You're working hard.<br />But on the wrong things.
        </h2>
        <p className="text-white/65 text-lg text-center leading-relaxed">
          Revision Village gives you questions. Save My Exams gives you notes. 
          Neither tells you whether you're actually on track for the grade you need. 
          You find out when results come back. By then it's too late.
        </p>
      </section>

      {/* Features */}
      <section className="px-6 py-10 max-w-4xl mx-auto pb-24">
        <p className="text-[#E8D5B0] text-xs font-bold tracking-widest 
        uppercase text-center mb-5">How It Works</p>
        <h2 className="text-white text-4xl font-bold text-center mb-16">
          Three things no other tool does together
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              emoji: '🗺️',
              title: 'Mapping out your syllabus.',
              desc: "Every topic and subtopic from your official curriculum in one place. No guessing what's on the exam."
            },
            {
              emoji: '🔴',
              title: 'A heatmap of your gaps.',
              desc: "Red means danger. Yellow means review. Green means solid. See exactly where you're weak before your teacher does."
            },
            {
              emoji: '📅',
              title: "Today's plan. Built for you.",
              desc: "Tell us your exam date and target grade. We reverse engineer your daily schedule around your weakest topics."
            }
          ].map((item, i) => (
            <div key={i} 
            className="rounded-2xl p-7 border border-white/10 
            hover:border-[#E8D5B0]/30 transition-colors"
            style={{background: 'rgba(255,255,255,0.06)'}}>
              <div className="text-4xl mb-5">{item.emoji}</div>
              <h3 className="text-white font-bold text-lg mb-3">{item.title}</h3>
              <p className="text-white/55 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="px-6 py-16 max-w-3xl mx-auto rounded-3xl mb-16"
      style={{background: 'rgba(0,0,0,0.15)'}}>
        <p className="text-[#E8D5B0] text-xs font-bold tracking-widest 
        uppercase text-center mb-5">Why PSyllabus</p>
        <h2 className="text-white text-4xl font-bold text-center mb-12">
          Not just another study tool
        </h2>
        <div className="space-y-4">
          {[
            { them: "Generic content not tied to your syllabus", us: "Every topic locked to your exact official curriculum" },
            { them: "No idea if you're actually on track", us: "Live predicted grade based on your progress" },
            { them: "$500/year for inconsistent quality", us: "Free during beta, fair pricing after" },
            { them: "Same experience for every student", us: "Adapts daily to your specific weak topics" },
          ].map((row, i) => (
            <div key={i} className="grid grid-cols-2 gap-4">
              <div className="rounded-xl px-5 py-4 flex items-center gap-3"
              style={{background: 'rgba(255,255,255,0.05)'}}>
                <span className="text-red-400 text-lg flex-shrink-0">✗</span>
                <p className="text-white/50 text-sm">{row.them}</p>
              </div>
              <div className="rounded-xl px-5 py-4 flex items-center gap-3"
              style={{background: 'rgba(232,213,176,0.1)', 
              border: '1px solid rgba(232,213,176,0.2)'}}>
                <span className="text-[#E8D5B0] text-lg flex-shrink-0">✓</span>
                <p className="text-white text-sm font-medium">{row.us}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Founder note */}
      <section className="px-6 py-24 max-w-2xl mx-auto text-center">
        <div className="text-5xl mb-8">✍️</div>
        <p className="text-white/70 text-lg leading-relaxed mb-8">
          "I built this because I was about to start IB with Math AA HL, 
          Economics HL, and CS HL and every tool I tried either gave me 
          random questions or charged me $500 for content that wasn't even 
          on the current syllabus. So I built what I actually needed."
        </p>
        <p className="text-white font-bold text-lg">Talal Al-Raisi</p>
        <p className="text-[#E8D5B0] text-sm mt-1">
          Founder · IB Student · Muscat, Oman
        </p>
      </section>

      {/* Footer */}
      <footer className="px-8 py-8 flex items-center justify-between 
      border-t border-white/10">
        <Image 
          src="/logo.png" 
          alt="PSyllabus" 
          width={110} 
          height={35}
          priority
        />
        <p className="text-white/30 text-xs">
          © 2026 PSyllabus · Built in Muscat, Oman
        </p>
      </footer>

    </main>
  )
}