import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_INVITE_ROLES = new Set(["editor", "viewer"]);
const ALLOWED_UPDATE_ROLES = new Set(["editor", "viewer"]);

function roleLabel(role: string): string {
  switch (role) {
    case "owner": return "Ägare";
    case "editor": return "Redigerare";
    case "viewer": return "Tittare";
    default: return role;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const authHeader = req.headers.get("Authorization");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader || "" } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "invite") {
      if (!user) throw new Error("Ej inloggad");
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!email) throw new Error("E-postadress saknas");

      // Validera roll (default editor)
      const requestedRole = (body.role ?? "editor").toString().toLowerCase();
      if (!ALLOWED_INVITE_ROLES.has(requestedRole)) {
        throw new Error("Ogiltig roll. Välj 'editor' eller 'viewer'.");
      }

      const { data: membership } = await supabaseAdmin
        .from("farm_members")
        .select("farm_id, role")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .single();

      if (!membership) throw new Error("Du har ingen gård att bjuda in till");

      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();

      if (existingProfile) {
        const { data: existingMember } = await supabaseAdmin
          .from("farm_members")
          .select("id")
          .eq("farm_id", membership.farm_id)
          .eq("user_id", existingProfile.user_id)
          .maybeSingle();
        if (existingMember)
          throw new Error("Denna person är redan medlem i din gård");
      }

      const { data: coop } = await supabaseAdmin
        .from("coop_settings")
        .select("coop_name")
        .eq("id", membership.farm_id)
        .single();

      const { data: inviterProfile } = await supabaseAdmin
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .single();

      const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      const farmName = escapeHtml(coop?.coop_name || "Hönsgården");
      const inviterName = escapeHtml(inviterProfile?.display_name || user.email || "Någon");
      const roleNameSv = roleLabel(requestedRole);
      const inviteToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
      // Äldre appversioner använder rollen i länken som visningstext.
      const inviteUrl = `https://honsgarden.se/inbjudan/${inviteToken}?role=${requestedRole}`;

      const { data: queueId, error: queueError } = await supabaseAdmin.rpc("queue_farm_invitation", {
        p_farm_id: membership.farm_id,
        p_invited_by: user.id,
        p_email: email,
        p_role: requestedRole,
        p_token: inviteToken,
        p_message: {
          run_id: crypto.randomUUID(),
          to: email,
          from: "Hönsgården <noreply@notify.honsgarden.se>",
          sender_domain: "notify.honsgarden.se",
          subject: `${inviterName} bjuder in dig till ${farmName} 🐔`,
          html: `<div style="font-family: Inter, Arial, sans-serif; max-width: 500px; padding: 30px 25px;">
            <img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style="margin: 0 0 24px;" />
            <h1 style="font-family: 'Young Serif', Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 20px;">Du har blivit inbjuden! 🎉</h1>
            <p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 16px;"><strong>${inviterName}</strong> vill att du går med i gården <strong>${farmName}</strong> som <strong>${roleNameSv}</strong>.</p>
            <p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 25px;">Tillsammans kan ni hålla koll på gården – allt på ett ställe.</p>
            <a href="${inviteUrl}" style="background-color: hsl(142,32%,34%); color: hsl(35,32%,97%); font-size: 14px; border-radius: 14px; padding: 12px 24px; text-decoration: none; display: inline-block;">Acceptera inbjudan →</a>
            <p style="font-size: 12px; color: #999; margin: 30px 0 0;">Inbjudan gäller i 7 dagar. Om du inte förväntade dig detta mejl kan du ignorera det.</p>
          </div>`,
          text: `${inviterName} bjuder in dig till ${farmName} på Hönsgården som ${roleNameSv}. Acceptera här: ${inviteUrl}`,
          purpose: "transactional",
          label: "farm-invitation",
          message_id: `farm-invite-${inviteToken}-${requestedRole}`,
          queued_at: new Date().toISOString(),
        },
      });

      if (queueError?.code === "PT409") throw new Error("Det finns redan en giltig inbjudan till den här e-postadressen.");
      if (queueError || queueId == null) {
        throw new Error("Inbjudan kunde inte köas för utskick. Försök igen om en stund.");
      }

      return new Response(JSON.stringify({ success: true, role: requestedRole }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-invite") {
      const { token } = body;
      if (!token) throw new Error("Token saknas");

      const { data: invite, error } = await supabaseAdmin
        .from("farm_invitations")
        .select("id, email, status, expires_at, farm_id, invited_by, role")
        .eq("token", token)
        .single();
      if (error || !invite) throw new Error("Inbjudan hittades inte");

      if (invite.status === "accepted")
        throw new Error("Inbjudan har redan accepterats");
      if (invite.status !== "pending")
        throw new Error("Inbjudan är inte längre giltig");
      if (new Date(invite.expires_at) < new Date())
        throw new Error("Inbjudan har gått ut. Be ägaren skicka en ny.");

      const { data: coop } = await supabaseAdmin
        .from("coop_settings")
        .select("coop_name")
        .eq("id", invite.farm_id)
        .single();

      if (!coop) throw new Error("Gården finns inte längre. Kontakta ägaren.");

      const { data: inviter } = await supabaseAdmin
        .from("profiles")
        .select("display_name, email")
        .eq("user_id", invite.invited_by)
        .single();

      return new Response(
        JSON.stringify({
          email: invite.email,
          farm_name: coop?.coop_name || "Hönsgården",
          status: invite.status,
          role: invite.role,
          inviter_name: inviter?.display_name || inviter?.email || "Ägaren",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "accept-invite") {
      if (!user) throw new Error("Du måste vara inloggad för att acceptera");
      const { token } = body;
      if (!token) throw new Error("Token saknas");

      const { data: invite } = await supabaseAdmin
        .from("farm_invitations")
        .select("*")
        .eq("token", token)
        .single();

      if (!invite) throw new Error("Inbjudan hittades inte");
      if (invite.status === "accepted") throw new Error("Inbjudan har redan accepterats");
      if (invite.status !== "pending") throw new Error("Inbjudan är inte längre giltig");
      if (new Date(invite.expires_at) < new Date())
        throw new Error("Inbjudan har gått ut. Be ägaren skicka en ny.");

      if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
        throw new Error(
          `Inbjudan skickades till ${invite.email}. Du är inloggad som ${user.email}. Logga in med rätt konto.`
        );
      }

      // Behörigheten bestäms när ägaren skapar inbjudan.
      const acceptedRole = invite.role === "editor" ? "editor" : "viewer";

      // Verifiera att gården fortfarande finns
      const { data: coop } = await supabaseAdmin
        .from("coop_settings")
        .select("id, coop_name, user_id")
        .eq("id", invite.farm_id)
        .single();
      if (!coop) throw new Error("Gården finns inte längre. Kontakta ägaren.");

      const { error: memberErr } = await supabaseAdmin
        .from("farm_members")
        .insert({
          farm_id: invite.farm_id,
          user_id: user.id,
          role: acceptedRole,
        });
      if (memberErr) {
        if (memberErr.code === "23505")
          throw new Error("Du är redan medlem i denna gård");
        throw new Error(memberErr.message);
      }

      await supabaseAdmin
        .from("farm_invitations")
        .update({ status: "accepted" })
        .eq("id", invite.id);

      // Notifiera ägaren via mail
      try {
        const { data: ownerProfile } = await supabaseAdmin
          .from("profiles")
          .select("email, display_name")
          .eq("user_id", invite.invited_by)
          .single();

        const { data: accepterProfile } = await supabaseAdmin
          .from("profiles")
          .select("display_name, email")
          .eq("user_id", user.id)
          .single();

        if (ownerProfile?.email) {
          const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
          const accepterName = escapeHtml(accepterProfile?.display_name || accepterProfile?.email || user.email || "Någon");
          const ownerName = escapeHtml(ownerProfile.display_name || ownerProfile.email?.split('@')[0] || 'där');
          const farmName = escapeHtml(coop.coop_name || "din gård");
          const roleNameSv = roleLabel(acceptedRole);

          await supabaseAdmin.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload: {
              run_id: crypto.randomUUID(),
              to: ownerProfile.email,
              from: "Hönsgården <noreply@notify.honsgarden.se>",
              sender_domain: "notify.honsgarden.se",
              subject: `${accepterName} har gått med i ${farmName} 🎉`,
              html: `<div style="font-family: Inter, Arial, sans-serif; max-width: 500px; padding: 30px 25px;">
                <img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style="margin: 0 0 24px;" />
                <h1 style="font-family: 'Young Serif', Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 20px;">Hej ${ownerName}!</h1>
                <p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 16px;"><strong>${accepterName}</strong> har accepterat din inbjudan till <strong>${farmName}</strong> och är nu med som <strong>${roleNameSv}</strong>.</p>
                <a href="https://honsgarden.se/app/settings" style="background-color: hsl(142,32%,34%); color: hsl(35,32%,97%); font-size: 14px; border-radius: 14px; padding: 12px 24px; text-decoration: none; display: inline-block;">Hantera medlemmar →</a>
                <p style="font-size: 12px; color: #999; margin: 30px 0 0;">Du får detta mejl för att du bjöd in en familjemedlem till din gård.</p>
              </div>`,
              text: `${accepterName} har gått med i ${farmName} som ${roleNameSv}.`,
              purpose: "transactional",
              label: "farm-invite-accepted",
              message_id: `invite-accepted-${invite.id}-${Date.now()}`,
              queued_at: new Date().toISOString(),
            },
          });
        }
      } catch (notifyErr) {
        console.error("[manage-farm] Misslyckades notifiera ägare om accept:", notifyErr);
      }

      return new Response(JSON.stringify({ success: true, role: acceptedRole }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update-member-role") {
      if (!user) throw new Error("Ej inloggad");
      const { member_id, role: newRole } = body;
      if (!member_id) throw new Error("Medlems-ID saknas");
      if (!ALLOWED_UPDATE_ROLES.has(newRole)) {
        throw new Error("Ogiltig roll. Endast 'editor' eller 'viewer' tillåts.");
      }

      // Verifiera caller är owner
      const { data: callerMembership } = await supabaseAdmin
        .from("farm_members")
        .select("farm_id, role")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .single();
      if (!callerMembership) throw new Error("Du är inte ägare och kan inte ändra roller");

      // Hämta målet och säkerställ samma farm + inte owner
      const { data: target } = await supabaseAdmin
        .from("farm_members")
        .select("id, user_id, role, farm_id")
        .eq("id", member_id)
        .single();
      if (!target) throw new Error("Medlem hittades inte");
      if (target.farm_id !== callerMembership.farm_id)
        throw new Error("Medlemmen tillhör inte din gård");
      if (target.role === "owner")
        throw new Error("Ägarens roll kan inte ändras");

      const { error: updErr } = await supabaseAdmin
        .from("farm_members")
        .update({ role: newRole })
        .eq("id", member_id);
      if (updErr) throw new Error(updErr.message);

      return new Response(JSON.stringify({ success: true, role: newRole }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "remove-member") {
      if (!user) throw new Error("Ej inloggad");
      const { member_id } = body;

      const { data: callerMembership } = await supabaseAdmin
        .from("farm_members")
        .select("farm_id, role")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .single();
      if (!callerMembership) throw new Error("Du är inte ägare");

      const { data: target } = await supabaseAdmin
        .from("farm_members")
        .select("user_id, role")
        .eq("id", member_id)
        .eq("farm_id", callerMembership.farm_id)
        .single();
      if (!target) throw new Error("Medlem hittades inte");
      if (target.role === "owner")
        throw new Error("Du kan inte ta bort ägaren");

      await supabaseAdmin.from("farm_members").delete().eq("id", member_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "leave-farm") {
      if (!user) throw new Error("Ej inloggad");
      const { farm_id } = body;

      const { data: membership } = await supabaseAdmin
        .from("farm_members")
        .select("id, role")
        .eq("farm_id", farm_id)
        .eq("user_id", user.id)
        .single();
      if (!membership) throw new Error("Du är inte medlem");
      if (membership.role === "owner")
        throw new Error("Ägaren kan inte lämna gården");

      await supabaseAdmin.from("farm_members").delete().eq("id", membership.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Okänd åtgärd");
  } catch (err: any) {
    console.error("[manage-farm] error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
