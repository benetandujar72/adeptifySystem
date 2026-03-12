import React, { useMemo } from 'react';

type Props = {
  onBack: () => void;
};

const BenetProfilePage: React.FC<Props> = ({ onBack }) => {
  const stats = useMemo(
    () => [
      { label: 'Years of experience', value: '+20' },
      { label: 'Centres supported', value: '+80' },
      { label: 'People impacted', value: '+5,000' },
    ],
    []
  );

  const events = useMemo(
    () => [
      {
        id: 1,
        title: '1st International Virtual Congress on Education',
        org: 'ISEP',
        desc: 'Speaker and trainer on lifelong learning and key competencies.',
        img: '/benet/benet-isep.svg',
      },
      {
        id: 2,
        title: 'Workshops on new trends in education',
        org: 'ISEP',
        desc: 'Workshops on innovation, ADHD and support for teachers and families.',
        img: '/benet/benet-taller-1.svg',
      },
      {
        id: 3,
        title: 'Seminars and workshops in educational centres',
        org: 'Various centres and organisations',
        desc: 'Sessions on the pedagogical use of social media, leadership and educational coaching.',
        img: '/benet/benet-evento-1.svg',
      },
    ],
    []
  );

  return (
    <div className="fade-up">
      <section className="w-full max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            type="button"
            onClick={onBack}
            className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 hover:text-indigo-700 transition"
          >
            ← Back
          </button>
        </div>

        <section className="grid gap-10 md:grid-cols-[1.6fr,1.2fr] md:items-center mb-16 md:mb-20">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-black uppercase tracking-[0.25em] text-slate-600">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Educational consulting · Coaching · Turnkey solutions
            </div>

            <div className="space-y-3">
              <h1 className="text-balance text-3xl md:text-4xl lg:text-5xl font-serif text-slate-900 leading-tight">
                Benet Andújar Guardado
              </h1>
              <p className="text-balance text-sm md:text-base font-bold text-indigo-700">
                Educational consultant, coach and architect of relationships between people, centres and technology.
              </p>
              <p className="max-w-xl text-sm md:text-base leading-relaxed text-slate-600 font-medium">
                Mathematics graduate, certified coach and Google Certified Trainer with over 20 years of experience
                supporting centres, management teams, teachers, families and young people through processes of
                educational change, always with a human approach and exquisite attention to match with each person.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="#servicios"
                className="inline-flex items-center justify-center bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.22em] hover:bg-indigo-600 transition-all shadow-lg"
              >
                See how it can help you
              </a>
              <a
                href="#contacto"
                className="inline-flex items-center justify-center bg-white text-slate-900 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.22em] border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all"
              >
                Propose a collaboration
              </a>
            </div>

            <div className="mt-2 grid gap-4 text-xs text-slate-600 sm:grid-cols-3 md:text-sm">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="bg-white border border-slate-100 rounded-2xl px-5 py-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
                >
                  <div className="text-xl font-black text-indigo-700">{s.value}</div>
                  <div className="text-[11px] font-bold text-slate-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-indigo-200/60 via-slate-100 to-indigo-100 blur-2xl" />
            <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-[0_20px_40px_rgba(0,0,0,0.06)]">
              <img
                src="/benet/benet-main.svg"
                alt="Benet Andújar at a conference"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/70 to-transparent p-4">
                <p className=”text-xs md:text-sm font-black text-slate-900”>
                  “Technology makes sense when it frees up time to care for people.”
                </p>
                <p className=”text-[11px] md:text-sm text-slate-500 font-medium”>
                  Coaching, educational leadership and digital solutions in service of human connection.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="enfoque" className="grid gap-8 md:grid-cols-2 md:items-start mb-16 md:mb-20">
          <div className="space-y-4">
            <h2 className="text-2xl md:text-3xl font-serif text-slate-900 italic">
              Human approach and genuine match with people
            </h2>
            <p className="text-sm md:text-base leading-relaxed text-slate-600 font-medium">
              His work is grounded in active listening and a holistic view of the person: history, emotions, context and
              goals are all considered when designing truly personalised and sustainable support processes.
            </p>
            <p className="text-sm md:text-base leading-relaxed text-slate-600 font-medium">
              Every intervention seeks to create an authentic match between the needs of students, families, teachers or
              management teams and the proposed solutions, whether those are coaching processes, training programmes or
              digital automations.
            </p>

            <ul className="mt-2 space-y-2 text-sm md:text-base text-slate-700 font-medium">
              <li className="flex gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                Careful support of emotional safety and relationship-building in every process.
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                Personalised pathways that respect the pace and strengths of each person or team.
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-slate-900 shrink-0" />
                Technology and automation understood as tools in service of human connection.
              </li>
            </ul>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-[0_20px_40px_rgba(0,0,0,0.06)]">
            <h3 className="text-sm md:text-base font-black text-indigo-700 tracking-tight">
              How the match with centres and people works
            </h3>
            <ol className="mt-4 space-y-3 text-sm text-slate-600 font-medium">
              <li>
                <span className="font-black text-slate-900">1. Listening and shared diagnosis.</span> Interviews,
                observation and dialogue with key stakeholders at the centre to understand culture, needs and pain points.
              </li>
              <li>
                <span className="font-black text-slate-900">2. Tailored design.</span> Support proposals,
                training programmes and digital solutions aligned with the centre's identity — not generic templates.
              </li>
              <li>
                <span className="font-black text-slate-900">3. Close-up support.</span> Follow-up, adjustments and
                co-evaluation with teams to ensure real impact on people and the organisation.
              </li>
            </ol>
          </div>
        </section>

        <section id="servicios" className="space-y-6 mb-16 md:mb-20">
          <h2 className="text-2xl md:text-3xl font-serif text-slate-900 italic">What he offers</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="bg-white border border-slate-100 rounded-2xl p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
              <h3 className="mb-2 text-sm md:text-base font-black text-slate-900 tracking-tight">
                Comprehensive educational consulting
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Support for management teams and staff in leadership, centre transformation, coexistence and
                wellbeing of the educational community.
              </p>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
              <h3 className="mb-2 text-sm md:text-base font-black text-slate-900 tracking-tight">Coaching and training</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Educational coaching programmes, sessions for families and teenagers, and teacher training on
                active learning methodologies, social media and socio-emotional competencies.
              </p>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
              <h3 className="mb-2 text-sm md:text-base font-black text-slate-900 tracking-tight">
                Turnkey digital solutions
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Functional design and support in the implementation of personalised digital automations and tools
                to free up time and keep the focus on people.
              </p>
            </div>
          </div>
        </section>

        <section id="eventos" className="space-y-6 mb-16 md:mb-20">
          <div>
            <h2 className="text-2xl md:text-3xl font-serif text-slate-900 italic">Congresses, workshops and events</h2>
            <p className="mt-3 text-slate-500 font-medium leading-relaxed max-w-2xl">
              A selection of moments in which he has shared experience with the educational community.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {events.map((event) => (
              <article
                key={event.id}
                className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.06)]"
              >
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={event.img}
                    alt={event.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/60 via-transparent" />
                </div>
                <div className="p-6">
                  <h3 className="font-black text-slate-900 tracking-tight">{event.title}</h3>
                  <p className="mt-2 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-700">{event.org}</p>
                  <p className="mt-3 text-sm text-slate-600 leading-relaxed font-medium">{event.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          id="contacto"
          className="bg-white border border-slate-100 rounded-2xl p-10 md:p-12 shadow-[0_20px_40px_rgba(0,0,0,0.06)] flex flex-col md:flex-row items-start md:items-center justify-between gap-10"
        >
          <div className="max-w-xl">
            <h2 className="text-2xl md:text-3xl font-serif text-slate-900 italic">Shall we talk?</h2>
            <p className="mt-3 text-slate-500 font-medium leading-relaxed">
              If you want to explore a collaboration, organise a training programme or design a tailored digital solution
              for your centre, you can contact Benet directly.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <a
              href="mailto:benet.andujar@insbitacola.cat"
              className="bg-slate-900 text-white px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.22em] hover:bg-indigo-600 transition-all shadow-lg text-center"
            >
              Send email
            </a>
            <a
              href="https://es.linkedin.com/in/bandujar"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-slate-900 px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.22em] border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all text-center"
            >
              View LinkedIn
            </a>
          </div>
        </section>
      </section>
    </div>
  );
};

export default BenetProfilePage;
