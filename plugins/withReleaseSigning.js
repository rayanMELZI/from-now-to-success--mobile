const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Signs release builds with the app's own key instead of the debug one.
 *
 * The android/ folder is generated at build time (`expo prebuild`), so the
 * signing setup cannot live in a committed build.gradle — this plugin writes
 * it in every time. The key itself never enters the repo: CI decodes it from a
 * secret and passes its path and passwords as Gradle properties. Without
 * those properties the build falls back to debug signing, as before.
 */
const RELEASE_SIGNING = `
        release {
            if (findProperty('FNTS_STORE_FILE')) {
                storeFile file(findProperty('FNTS_STORE_FILE'))
                storePassword findProperty('FNTS_STORE_PASSWORD')
                keyAlias findProperty('FNTS_KEY_ALIAS')
                keyPassword findProperty('FNTS_KEY_PASSWORD')
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (gradle.includes("FNTS_STORE_FILE")) return mod;

    gradle = gradle.replace(/signingConfigs\s*\{/, (match) => `${match}${RELEASE_SIGNING}`);

    // The release build type is the one that still signs with debug.
    const releaseBlock = /(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/;
    if (!releaseBlock.test(gradle)) {
      throw new Error("withReleaseSigning: could not find the release signingConfig in app/build.gradle");
    }
    gradle = gradle.replace(
      releaseBlock,
      "$1signingConfig findProperty('FNTS_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );

    mod.modResults.contents = gradle;
    return mod;
  });
};
