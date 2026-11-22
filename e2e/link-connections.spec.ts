import { expect, test } from "@playwright/test";

import { expectAccessible, profileInviteLink, signUpAndOnboard } from "./helpers";

/**
 * No duplicate people when someone connects. A (Amal) already added "Sami
 * K." with a birthday of 1 June. Sami joins through A's personal link (his
 * profile says 3 March). A gets the question on People, links "Sami K."
 * (never matched for her), is asked about the different birthday, and keeps
 * her own. Edit → Their account shows the link and Unlink, which brings the
 * question back.
 */
test("someone joins through your link: link them to a person you already added", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const [a, b] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [pageA, pageB] = await Promise.all([a.newPage(), b.newPage()]);
  await signUpAndOnboard(pageA, "Amal");
  await signUpAndOnboard(pageB, "Sami", { day: "3", month: "3" });

  // A's record for Sami, before he joins.
  await pageA.goto("/people");
  await pageA.getByRole("button", { name: "Add someone" }).first().click();
  const add = pageA.getByRole("dialog", { name: "Add someone" });
  await add.getByLabel("Their name").fill("Sami K.");
  const bday = add.getByRole("group", { name: "Their birthday" });
  await bday.getByRole("combobox", { name: "Day" }).selectOption("1");
  await bday.getByRole("combobox", { name: "Month" }).selectOption("6");
  await add.getByRole("button", { name: "Add Sami K.", exact: true }).click();
  await expect(add).toBeHidden();
  await expect(pageA.getByText(/joined through your link/)).toHaveCount(0);

  // Sami joins through A's personal link.
  const url = await profileInviteLink(pageA);
  await pageB.goto(url);
  await pageB.getByRole("button", { name: "Connect with Amal" }).click();
  await expect(pageB.getByRole("heading", { name: /You're connected with Amal/ })).toBeVisible();

  // A: the question, never an automatic match.
  await pageA.goto("/people");
  const banner = pageA.getByRole("region", { name: "New connection" });
  await expect(banner).toContainText(
    "Sami joined through your link. Is this someone you already added?",
  );
  await expect(pageA.getByRole("link", { name: /^Sami K\./ })).not.toContainText("Connected");
  await banner.getByRole("button", { name: "Choose" }).click();
  const dialog = pageA.getByRole("dialog", { name: "Is Sami someone you already added?" });
  await dialog.getByLabel("Your people").fill("sam");
  await expectAccessible(pageA, "link prompt");
  await dialog.getByRole("button", { name: "Link Sami K." }).click();
  // His profile says 3 March, A said 1 June: asked, not changed.
  await expect(dialog.getByText("Their profile says 3 March. Use theirs?")).toBeVisible();
  await dialog.getByRole("button", { name: "Keep mine" }).click();
  await expect(dialog).toBeHidden();
  await expect(banner).toBeHidden();
  const card = pageA.getByRole("link", { name: /^Sami K\./ });
  await expect(card).toContainText("Connected");
  await expect(card).toContainText("Birthday");

  // Edit → Their account: linked, and Unlink brings the question back.
  await card.click();
  await pageA.getByRole("button", { name: "Edit Sami K." }).click();
  const edit = pageA.getByRole("dialog", { name: "Edit person" });
  await expect(edit.getByText(/Linked to Sami's account/)).toBeVisible();
  await edit.getByRole("button", { name: "Unlink" }).click();
  await expect(edit).toBeHidden();
  await expect(pageA.getByRole("region", { name: "New connection" })).toBeVisible();

  await a.close();
  await b.close();
});
