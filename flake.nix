{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    systems.url = "github:nix-systems/default";
    devenv.url = "github:cachix/devenv";
  };

  outputs = { self, nixpkgs, devenv, systems, ... } @ inputs:
    let
      forEachSystem = nixpkgs.lib.genAttrs (import systems);
    in
    {
      devShells = forEachSystem
        (system:
          let
            pkgs = nixpkgs.legacyPackages.${system};
          in
          {
            default = devenv.lib.mkShell {
              inherit inputs pkgs;
              modules = [
                {
                  packages = with pkgs; [ nodejs nodePackages_latest.pnpm ];
                  enterShell = ''
                    export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
                    export PUPPETEER_EXECUTABLE_PATH=${pkgs.chromium.outPath}/bin/chromium
                  ''; 
                }
              ];
            };
          });
    };
}
