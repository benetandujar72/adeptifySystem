import React, { useMemo } from 'react';

type Props = {
  onBack: () => void;
};

const BenetProfilePage: React.FC<Props> = ({ onBack }) => {
  const stats = useMemo(
    () => [
      { label: 'Años de experiencia', value: '+20' },
      { label: 'Centros acompañados', value: '+80' },
      { label: 'Personas impactadas', value: '+5.000' },
    ],
    []
  );

  const events = useMemo(
    () => [
      {
        id: 1,
        title: 'I Congreso Internacional Virtual de Educación',
        org: 'ISEP',
        desc: 'Ponente y formador en aprendizaje para la vida y competencias clave.',
        img: '/benet/benet-isep.svg',
      },
      {
        id: 2,
        title: 'Jornadas de nuevas tendencias en educación',
        org: 'ISEP',
        desc: 'Talleres sobre innovación, TDAH y acompañamiento a docentes y familias.',
        img: '/benet/benet-taller-1.svg',
      },
      {
        id: 3,
        title: 'Seminarios y jornadas en centros educativos',
        org: 'Centros y entidades diversas',
        desc: 'Sesiones sobre uso pedagógico de redes sociales, liderazgo y coaching educativo.',
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
            ← Volver
          </button>
        </div>

        <section className="grid gap-10 md:grid-cols-[1.6fr,1.2fr] md:items-center mb-16 md:mb-20">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-black uppercase tracking-[0.25em] text-slate-600">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Consultoría educativa · Coaching · Soluciones llave en mano
            </div>

            <div className="space-y-3">
              <h1 className="text-balance text-3xl md:text-4xl lg:text-5xl font-serif text-slate-900 leading-tight">
                Benet Andújar Guardado
              </h1>
              <p className="text-balance text-sm md:text-base font-bold text-indigo-700">
                Consultor educativo, coach y arquitecto de relaciones entre personas, centros y tecnología.
              </p>
              <p className="max-w-xl text-sm md:text-base leading-relaxed text-slate-600 font-medium">
                Licenciado en matemáticas, coach certificado y Google Trainer Certified con más de 20 años de experiencia
                acompañando a centros, equipos directivos, docentes, familias y adolescentes en procesos de cambio
                educativo, siempre con un enfoque humano y un cuidado exquisito del match con cada persona.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="#servicios"
                className="inline-flex items-center justify-center bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.22em] hover:bg-indigo-600 transition-all shadow-lg"
              >
                Ver cómo puede ayudarte
              </a>
              <a
                href="#contacto"
                className="inline-flex items-center justify-center bg-white text-slate-900 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.22em] border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all"
              >
                Proponer una colaboración
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
                alt="Benet Andújar en conferencia"
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/70 to-transparent p-4">
                <p className="text-xs md:text-sm font-black text-slate-900">
                  “La tecnología tiene sentido cuando libera tiempo para cuidar a las personas.”
                </p>
                <p className="text-[11px] md:text-sm text-slate-500 font-medium">
                  Coaching, liderazgo educativo y soluciones digitales al servicio del vínculo.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="enfoque" className="grid gap-8 md:grid-cols-2 md:items-start mb-16 md:mb-20">
          <div className="space-y-4">
            <h2 className="text-2xl md:text-3xl font-serif text-slate-900 italic">
              Enfoque humano y match con las personas
            </h2>
            <p className="text-sm md:text-base leading-relaxed text-slate-600 font-medium">
              Su trabajo parte de la escucha activa y de una mirada integral a la persona: historia, emociones, contexto y
              objetivos se tienen en cuenta para diseñar procesos de acompañamiento realmente personalizados y sostenibles.
            </p>
            <p className="text-sm md:text-base leading-relaxed text-slate-600 font-medium">
              Cada intervención busca generar un match auténtico entre las necesidades de alumnos, familias, docentes o
              equipos directivos y las soluciones propuestas, ya sean procesos de coaching, formaciones o automatizaciones
              digitales.
            </p>

            <ul className="mt-2 space-y-2 text-sm md:text-base text-slate-700 font-medium">
              <li className="flex gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                Acompañamiento cuidadoso del vínculo y de la seguridad emocional en cada proceso.
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                Itinerarios personalizados que respetan el ritmo y las fortalezas de cada persona o equipo.
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-slate-900 shrink-0" />
                Tecnología y automatización entendidas como herramientas al servicio de la relación humana.
              </li>
            </ul>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-[0_20px_40px_rgba(0,0,0,0.06)]">
            <h3 className="text-sm md:text-base font-black text-indigo-700 tracking-tight">
              Cómo trabaja el match con centros y personas
            </h3>
            <ol className="mt-4 space-y-3 text-sm text-slate-600 font-medium">
              <li>
                <span className="font-black text-slate-900">1. Escucha y diagnóstico compartido.</span> Entrevistas,
                observación y diálogo con los agentes clave del centro para entender cultura, necesidades y puntos de dolor.
              </li>
              <li>
                <span className="font-black text-slate-900">2. Diseño a medida.</span> Propuestas de acompañamiento,
                formaciones y soluciones digitales alineadas con la identidad del centro, no plantillas genéricas.
              </li>
              <li>
                <span className="font-black text-slate-900">3. Acompañamiento cercano.</span> Seguimiento, ajustes y
                coevaluación con los equipos para asegurar impacto real en las personas y en la organización.
              </li>
            </ol>
          </div>
        </section>

        <section id="servicios" className="space-y-6 mb-16 md:mb-20">
          <h2 className="text-2xl md:text-3xl font-serif text-slate-900 italic">Qué ofrece</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="bg-white border border-slate-100 rounded-2xl p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
              <h3 className="mb-2 text-sm md:text-base font-black text-slate-900 tracking-tight">
                Consultoría educativa integral
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Acompañamiento a equipos directivos y claustros en liderazgo, transformación de centro, convivencia y
                bienestar de la comunidad educativa.
              </p>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
              <h3 className="mb-2 text-sm md:text-base font-black text-slate-900 tracking-tight">Coaching y formación</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Programas de coaching educativo, sesiones para familias y adolescentes, y formación al profesorado sobre
                metodologías activas, redes sociales y competencias socioemocionales.
              </p>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
              <h3 className="mb-2 text-sm md:text-base font-black text-slate-900 tracking-tight">
                Soluciones digitales llave en mano
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Diseño funcional y acompañamiento en la implantación de automatizaciones y herramientas digitales
                personalizadas para liberar tiempo y poner el foco en las personas.
              </p>
            </div>
          </div>
        </section>

        <section id="eventos" className="space-y-6 mb-16 md:mb-20">
          <div>
            <h2 className="text-2xl md:text-3xl font-serif text-slate-900 italic">Congresos, jornadas y eventos</h2>
            <p className="mt-3 text-slate-500 font-medium leading-relaxed max-w-2xl">
              Una selección de momentos en los que ha compartido experiencia con la comunidad educativa.
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
                    loading="lazy"
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
            <h2 className="text-2xl md:text-3xl font-serif text-slate-900 italic">¿Hablamos?</h2>
            <p className="mt-3 text-slate-500 font-medium leading-relaxed">
              Si quieres explorar una colaboración, organizar una formación o diseñar una solución digital a medida para tu
              centro, puedes contactar con Benet directamente.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <a
              href="mailto:benet.andujar@insbitacola.cat"
              className="bg-slate-900 text-white px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.22em] hover:bg-indigo-600 transition-all shadow-lg text-center"
            >
              Escribir email
            </a>
            <a
              href="https://es.linkedin.com/in/bandujar"
              target="_blank"
              rel="noreferrer"
              className="bg-white text-slate-900 px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.22em] border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all text-center"
            >
              Ver LinkedIn
            </a>
          </div>
        </section>
      </section>
    </div>
  );
};

export default BenetProfilePage;
