// wrangler.toml has a Text rule for **/*.md, so prompt files import as a string.
declare module "*.md" {
  const content: string;
  export default content;
}
