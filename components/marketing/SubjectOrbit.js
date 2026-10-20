import Link from 'next/link'
import Image from 'next/image'
import logoMark from '@/public/logo-mark.png'
import { IconArrowRight } from '@/components/Icons'
import { SubjectTile } from '@/components/marketing/SubjectIcons'

/**
 * Every subject circling the one app: three rings turning at different
 * speeds, each tile turning back the other way so it stays upright. The
 * rings are only drawn in CSS, so this renders on the server and costs no
 * JavaScript. It echoes the subject map inside the app, which is the same
 * shape for a single subject.
 *
 * `--k` is the unit every size is measured in, smaller on a phone.
 */

const RINGS = [
  { radius: 8, seconds: 34, subjects: ['physics', 'maths', 'english', 'biology'] },
  { radius: 14, seconds: 52, subjects: ['chemistry', 'economics', 'history', 'languages', 'geography'] },
  { radius: 20, seconds: 74, subjects: ['arts', 'computing', 'psychology', 'music', 'tok'] },
]

export default function SubjectOrbit({ subjects = 173 }) {
  return (
    <div
      className="relative mx-auto flex max-w-6xl flex-col overflow-hidden rounded-[28px] border md:h-[32rem] md:flex-row md:items-center"
      style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
    >
      <div className="relative z-10 p-7 sm:p-10 md:w-[46%] md:pr-0">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
          Every subject
        </p>
        <h2 className="mt-4 text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
          Your whole course,
          <br />
          <span style={{ color: 'var(--brand)' }}>in one orbit.</span>
        </h2>
        <p className="mt-5 max-w-md text-[15.5px] leading-relaxed" style={{ color: 'var(--text-body)' }}>
          {subjects} subjects across the IB, A-Levels and AP. Sciences, maths, languages, humanities and
          the arts, each broken into the subtopics your exam is written from.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/signup" className="btn btn-solid control-lg">
            Start free
            <IconArrowRight width={16} height={16} />
          </Link>
          <Link href="/pricing" className="btn btn-outline control-lg">
            See pricing
          </Link>
        </div>
      </div>

      <div aria-hidden="true" className="relative h-[24rem] overflow-hidden [--k:0.72rem] md:h-full md:flex-1 md:overflow-visible md:[--k:1rem]">
        {/* Fades the rings out where they meet the text. */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-24 md:block"
          style={{ background: 'linear-gradient(to right, var(--surface), transparent)' }}
        />
        <div className="absolute left-1/2 top-1/2 md:left-[62%]">
          {RINGS.map((ring, r) => (
            <div
              key={r}
              className="orbit-ring absolute rounded-full border-2 border-dashed"
              style={{
                width: `calc(var(--k) * ${ring.radius * 2})`,
                height: `calc(var(--k) * ${ring.radius * 2})`,
                left: `calc(var(--k) * ${-ring.radius})`,
                top: `calc(var(--k) * ${-ring.radius})`,
                borderColor: 'var(--border-strong)',
                animationDuration: `${ring.seconds}s`,
                animationDirection: r % 2 ? 'reverse' : 'normal',
              }}
            >
              {ring.subjects.map((name, i) => {
                const a = (i / ring.subjects.length) * Math.PI * 2 + r * 0.6
                return (
                  <div
                    key={`${name}-${i}`}
                    className="absolute"
                    style={{
                      left: `${50 + 50 * Math.cos(a)}%`,
                      top: `${50 + 50 * Math.sin(a)}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <div
                      className="orbit-ring"
                      style={{ animationDuration: `${ring.seconds}s`, animationDirection: r % 2 ? 'normal' : 'reverse' }}
                    >
                      <SubjectTile name={name} size={r === 0 ? 54 : 50} icon={r === 0 ? 25 : 23} />
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          {/* The hub: the mark, without the word. */}
          <div
            className="absolute flex items-center justify-center rounded-full border shadow-xl"
            style={{
              width: 'calc(var(--k) * 7)',
              height: 'calc(var(--k) * 7)',
              left: 'calc(var(--k) * -3.5)',
              top: 'calc(var(--k) * -3.5)',
              borderColor: 'var(--border-strong)',
              background: 'var(--bg)',
            }}
          >
            <span className="relative block overflow-hidden" style={{ width: 'calc(var(--k) * 2.9)', height: 'calc(var(--k) * 3.1)' }}>
              <Image
                src={logoMark}
                alt=""
                sizes="120px"
                className="absolute left-0 top-0 max-w-none"
                style={{
                  height: 'calc(var(--k) * 3.1)',
                  width: 'auto',
                  clipPath: 'polygon(0 0, 33.5% 0, 33.5% 70%, 23.5% 70%, 23.5% 100%, 0 100%)',
                }}
              />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
