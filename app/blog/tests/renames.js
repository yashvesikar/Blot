describe("blog handles renames", function () {
  require("./util/setup")();

  it("will detect a renamed entry", async function () {
    
    await this.template({
      "entries.html": "{{#entries}}{{dateStamp}}{{/entries}}",
    });

    const now = Date.now();

    await this.write({ path: "/first.txt", content: "# Hey\n\nFoo bar baz" });

    const firstDatestamp = await this.text(`/`);

    expect(parseInt(firstDatestamp)).toBeGreaterThanOrEqual(now);

    await this.remove("/first.txt");

    expect(await this.text(`/`)).toEqual("");

    await this.write({
      path: "/renamed.txt",
      content: "# Hey\n\nFoo bar baz",
    });
    
    const renamedDatestamp = await this.text(`/`);

    expect(renamedDatestamp).toEqual(firstDatestamp);
  });
});
