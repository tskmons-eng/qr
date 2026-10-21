import { WORKFLOW_SETTING_TOGGLES } from '../../lib/settingsConfig'
import CancelPasscodeSettings from './CancelPasscodeSettings'
import SettingsGroup, { SettingToggleRow } from './SettingsGroup'
import TaxRateSettings from './TaxRateSettings'

// 「お店の運用」：スタッフ・厨房・レジでの動き。開いている端末にもすぐ反映される。
export default function StoreOperationSettings({ storeId, config, statuses, onSave }) {
  return (
    <SettingsGroup title="お店の運用" lead="スタッフ・厨房・レジでの動きです。押すとすぐ保存され、開いている端末にもすぐ反映されます。">
      <div className="admin-settings__panel admin-settings__panel--flush">
        {WORKFLOW_SETTING_TOGGLES.map(setting => (
          <SettingToggleRow
            key={setting.key}
            label={setting.label}
            description={setting.description}
            on={config[setting.key]}
            status={statuses[setting.key]}
            onToggle={() => onSave(setting.key, { [setting.key]: !config[setting.key] })}
          />
        ))}
        <TaxRateSettings
          taxRate={config.taxRate}
          status={statuses.taxRate}
          onSave={patch => onSave('taxRate', patch)}
        />
      </div>
      <CancelPasscodeSettings storeId={storeId} />
    </SettingsGroup>
  )
}
