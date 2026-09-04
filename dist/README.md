# Built APKs

Release builds committed here so a working binary travels with the source.

| File | ABI | Notes |
| --- | --- | --- |
| `batteryscope-v1.0-arm64-v8a.apk` | arm64-v8a only | Signed with the debug keystore |

## Regenerating

```bash
./android/gradlew.bat -p android assembleRelease
cp android/app/build/outputs/apk/release/app-release.apk \
   dist/batteryscope-v1.0-arm64-v8a.apk
```

Gradle writes to `android/app/build/`, which `.gitignore` excludes, so the copy
into this directory is what makes a build committable.

## Two things this APK is not

**Not multi-ABI.** `reactNativeArchitectures` in `android/gradle.properties` is
narrowed to `arm64-v8a`, which cuts build time from ~16 minutes to ~3. It will
not install on a 32-bit device or an x86 emulator. Restore the full list before
building anything meant for other people.

**Not production-signed.** It uses the React Native template's debug keystore.
That installs fine and is enough for personal use, but it cannot go to Play
Store, and switching to a real keystore later requires uninstalling first —
which wipes stored battery history. Export to CSV before doing that.

Each committed APK adds its full size (~48 MB) to git history permanently. If
this directory grows, move it to Git LFS or GitHub Releases.
