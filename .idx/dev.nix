
# To learn more about how to use Nix to configure your environment
# see: https://firebase.google.com/docs/studio/customize-workspace
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # or "unstable"

  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.android-sdk
    pkgs.gnumake
    pkgs.which
    pkgs.stdenv.cc.cc.lib
  ];

  # Sets environment variables in the workspace
  env = {
    ANDROID_HOME = "${pkgs.android-sdk}/libexec/android-sdk";
    # PATH is a special environment variable that needs to be handled carefully.
    # We use mkForce to overwrite the existing PATH and mkBefore to prepend our new paths.
    PATH = pkgs.lib.mkForce (pkgs.lib.mkBefore "${pkgs.android-sdk}/libexec/android-sdk/platform-tools:${pkgs.android-sdk}/libexec/android-sdk/emulator:${pkgs.android-sdk}/libexec/android-sdk/tools:${pkgs.android-sdk}/libexec/android-sdk/tools/bin:$PATH");
  };
  
  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      # "vscodevim.vim"
    ];
  };
}
