import { countDoneSetupSteps } from '../../lib/storeSetup'

// 席一覧の上の「はじめの準備」（2026-10-22 店舗登録）。済んだものに印、押すとその画面へ。
export default function StoreSetupGuide({ steps, canFinish, onOpen, onFinish }) {
  const requiredSteps = steps.filter(step => !step.optional)
  const doneCount = countDoneSetupSteps(requiredSteps)

  return (
    <section className="store-setup" aria-label="はじめの準備">
      <div className="store-setup__head">
        <b>はじめの準備</b>
        <span className="store-setup__bar"><i className={`store-setup__bar-fill store-setup__bar-fill--${doneCount}`} /></span>
        <span className="store-setup__count">{doneCount}/{requiredSteps.length}</span>
      </div>
      {steps.map((step, index) => (
        <button
          key={step.key}
          type="button"
          onClick={() => onOpen(step)}
          className={`store-setup__step${step.done ? ' is-done' : ''}${step.current ? ' is-current' : ''}`}
        >
          <span className="store-setup__num">{step.done ? '✓' : index + 1}</span>
          <span className="store-setup__text">
            <b>{step.label}</b>
            <span>{step.hint}</span>
          </span>
          <span className="store-setup__go">{step.current ? step.action : step.done ? '直す' : '›'}</span>
        </button>
      ))}
      {/* 済んでいなくても閉じられる（前からの店や、スタッフを登録しない運用もあるため）。 */}
      <button type="button" onClick={onFinish} className="ui-button ui-button--soft ui-button--block store-setup__finish">
        {canFinish ? '準備を終える（この案内を閉じる）' : 'あとでやる（この案内を閉じる）'}
      </button>
    </section>
  )
}
