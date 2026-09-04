package com.batteryscope.telemetry

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class BatteryTelemetryPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    when (name) {
      BatteryTelemetryModule.NAME -> BatteryTelemetryModule(reactContext)
      BatteryScopeFilesModule.NAME -> BatteryScopeFilesModule(reactContext)
      else -> null
    }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      BatteryTelemetryModule.NAME to turboModuleInfo(BatteryTelemetryModule.NAME),
      BatteryScopeFilesModule.NAME to turboModuleInfo(BatteryScopeFilesModule.NAME),
    )
  }

  private fun turboModuleInfo(name: String) =
    ReactModuleInfo(
      name,
      name,
      false, // canOverrideExistingModule
      false, // needsEagerInit
      false, // isCxxModule
      true, // isTurboModule
    )
}
