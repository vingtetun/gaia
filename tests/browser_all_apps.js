
function test() {
  let content = getContentWindow();
  SimpleTest.ok(true);
  SimpleTest.ok(false);
  SimpleTest.todo(true === false);
}
