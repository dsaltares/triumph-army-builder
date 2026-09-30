import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Callout,
  LegalDocument,
  LegalHeading,
  LegalSection,
  LegalTable,
  Prose,
  supportEmail,
} from '@/components/legal/legal-document';
import { externalLinks, routes } from '@/lib/navigation';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description:
    'What Triumph! Army Builder collects, who else sees it, how long it is kept and how to have it deleted.',
};

const operator = 'Saltares Marquez David Persoana Fizica Autorizata';

const recipients = [
  {
    key: 'resend',
    who: (
      <>
        <strong>Resend</strong> (email delivery)
      </>
    ),
    sees: 'Your email address and the contents of the message',
    why: 'Only to deliver the two emails this app sends: the link that confirms your address when you sign up with a password, and the password reset link when you ask for one. No newsletters, no announcements, no marketing, and no other message of any kind. If you only ever sign in with Google or Discord and never reset a password, Resend never sees your address.',
  },
  {
    key: 'providers',
    who: (
      <>
        <strong>Google</strong> and <strong>Discord</strong> (sign-in)
      </>
    ),
    sees: 'That you signed in to this app, at the moment you do it',
    why: 'Only if you choose to sign in with them. Their handling of your information is governed by their own privacy policies, not this one. If you sign in with a password, neither is involved.',
  },
  {
    key: 'cloudflare',
    who: (
      <>
        <strong>Cloudflare</strong> (network and security)
      </>
    ),
    sees: 'Request metadata — IP address, user agent, requested URL — as traffic passes through their network',
    why: 'Cloudflare sits in front of the server on every request, terminating TLS and filtering malicious traffic. They act as our processor.',
  },
];

const retention = [
  {
    key: 'account',
    what: 'Account information and your saved lists',
    period: 'Until you ask us to delete your account, and then no longer',
  },
  {
    key: 'sessions',
    what: 'Session records, including IP address and user agent',
    period:
      'Until the session expires, you sign out, or the session is revoked',
  },
  {
    key: 'anonymous',
    what: 'Anonymous records and the lists held against them',
    period: (
      <>
        Deleted when they hold no lists, and in any case after{' '}
        <strong>24 months</strong> untouched
      </>
    ),
  },
  {
    key: 'shares',
    what: 'A list you shared with a short link',
    period: (
      <>
        Until <strong>24 months</strong> pass with nobody opening the link
      </>
    ),
  },
  {
    key: 'activity',
    what: 'The activity log, including IP address and approximate location',
    period: (
      <>
        Until further notice. There is <strong>no fixed expiry</strong>
      </>
    ),
  },
  {
    key: 'tokens',
    what: 'Confirmation and password reset tokens',
    period: 'Until used, and otherwise a matter of minutes',
  },
  {
    key: 'backups',
    what: 'Backup snapshots',
    period:
      'Deleted records survive in existing snapshots until those snapshots age out of the rotation',
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy policy"
      summary="What this app collects, why, who else ever sees it, how long it is kept and what you can ask us to do about it."
    >
      <Prose>
        <p>
          This privacy policy (“Policy”) describes the personal information the{' '}
          <strong>Triumph! Army Builder</strong> website at{' '}
          <strong>triumph.saltares.dev</strong> (“Website”, “Service” or
          “Services”) collects from you. It is written to describe this
          particular app rather than to cover every practice a template might
          anticipate, so where it says we do not do something, we do not do it.
        </p>
        <p>
          The Website is operated by <strong>{operator}</strong> (“we”, “us” or
          “our”), and is the data controller for the personal information
          described here. It is a hobby project run by one person: an army list
          builder for <em>TRIUMPH!</em>, a historical miniature wargame
          published by the Washington Grand Company. It is not their app and it
          is not affiliated with or endorsed by them. By using the Website you
          agree to this Policy. If you do not agree, you should not use the
          Website.
        </p>
      </Prose>

      <LegalSection title="What we collect">
        <Prose>
          <p>
            You can browse the army lists, categories and reference material
            without an account, without signing in and without telling us
            anything about yourself. Reading pages creates no account, no
            anonymous record and no cookie; it is counted in the{' '}
            <a href="#activity-log">activity log</a> described below, and
            nothing else. Everything in this section is collected only when you
            start an army list or create an account.
          </p>

          <LegalHeading>Account information</LegalHeading>
          <ul>
            <li>
              <strong>Email address and display name.</strong> Typed by you when
              you sign up with a password, or supplied by your identity provider
              when you choose to sign in with Google or Discord.
            </li>
            <li>
              <strong>A password hash</strong>, if you created a password
              credential. We never store, see or log your password itself — only
              a one-way hash of it, from which the password cannot be recovered.
            </li>
            <li>
              <strong>A profile image URL</strong>, if your identity provider
              supplies one. We store the address, not a copy of the image.
            </li>
            <li>
              <strong>Whether your email address has been confirmed.</strong>
            </li>
          </ul>

          <LegalHeading>Sign-in with Google or Discord</LegalHeading>
          <p>
            If you choose to sign in with an identity provider, we ask that
            provider for the narrowest set of information that lets us identify
            you and give you your lists back:
          </p>
          <ul>
            <li>
              <strong>Google</strong> — the <code>openid</code>,{' '}
              <code>email</code> and <code>profile</code> scopes: a stable
              account identifier, your email address, your name and your profile
              picture. We do not request access to Gmail, Drive, Contacts,
              Calendar or any other Google service, and we could not read them
              if we tried.
            </li>
            <li>
              <strong>Discord</strong> — the <code>identify</code> and{' '}
              <code>email</code> scopes: your Discord user id, username, avatar
              and email address. We do not request access to your servers, your
              messages, your friends or your presence.
            </li>
          </ul>
          <p>
            We store the provider name, the account identifier that provider
            gave you, the granted scopes and the tokens the sign-in produced.
            Tokens are used to complete the sign-in and to link your account; we
            do not use them to call the provider’s other APIs on your behalf.
            Signing in this way does not give us your password at that provider,
            and it does not let us post anything anywhere.
          </p>

          <LegalHeading>Session records</LegalHeading>
          <p>
            When you are signed in — or when you have saved a list without
            signing up, as described below — we store a session record so that
            the next request knows it is you. Each holds a session token, an
            expiry time, and the <strong>IP address</strong> and{' '}
            <strong>browser user agent string</strong> the session was created
            from. We disclose those last two because they are personal
            information, not because we analyse them; they exist so that a
            session can be attributed and, if necessary, revoked.
          </p>

          <LegalHeading>Your army lists</LegalHeading>
          <p>
            An army list you save holds a name you chose, a reference to the
            published army list it is built from, a compact record of the
            stands, options and battle cards you selected, the version of the
            underlying army data it was built against, and the times it was
            created and last changed. That is the whole of it. There is no
            free-text field we mine and nothing in a saved list identifies you
            beyond the fact that it is yours.
          </p>

          <LegalHeading>Confirming your address</LegalHeading>
          <p>
            An account created with a password must confirm its email address
            before it can be used: we send a link to the address you gave us,
            and there is no session until you follow it. This exists so that an
            address on an account means somebody proved they can read mail
            there, which is what stops a stranger claiming an address that is
            yours.
          </p>
          <p>
            To do that — and to reset a forgotten password — we store a
            short-lived single-use token against your email address until it is
            used or expires. Confirmation and reset requests are rate-limited
            per address, per IP address and against a daily send budget, so
            neither can be used to flood someone’s inbox.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="If you never sign up">
        <Callout>
          <p>
            <strong>
              The Website lets you build and save army lists without creating an
              account, and those lists are stored on our server.
            </strong>{' '}
            This section describes what that means, and it is the part of this
            Policy most worth reading, because most privacy policies leave it
            out.
          </p>
        </Callout>
        <Prose>
          <p>
            Browsing creates no record of you. The{' '}
            <em>first time you start a list</em> without being signed in — by
            pressing <em>New list</em> on an army, or by saving a list you had
            been building — we create an anonymous user record and place a
            session cookie in your browser. From then on the builder keeps that
            list up to date as you change it, without asking again. That record
            has no email address, no name and no password; the cookie is the
            only thing tying it to you, and it identifies a browser rather than
            a person. Against it we store your saved lists and a session record,
            which — as above — includes the IP address and user agent of the
            request that created it.
          </p>
          <p>Three consequences follow, and all three are true by design:</p>
          <ul>
            <li>
              <strong>Anonymous lists are per-browser.</strong> Lists saved on
              your phone and lists saved on your laptop are separate, and
              clearing your cookies or site data loses the connection to them
              for good. We have no way to identify you and give them back,
              because we never knew who you were.
            </li>
            <li>
              <strong>Signing in claims them.</strong> When you later create an
              account or sign in to an existing one from the same browser, the
              lists held against the anonymous record are reassigned to your
              account and the anonymous record is deleted. We tell you in the
              interface when this happens.
            </li>
            <li>
              <strong>They do not last forever.</strong> An anonymous record
              that holds no lists is deleted, and an anonymous record untouched
              for <strong>24 months</strong> is deleted along with the lists
              held against it. This is content we hold for someone who never
              registered and never agreed to anything, so we do not keep it
              indefinitely.
            </li>
          </ul>
        </Prose>
      </LegalSection>

      <LegalSection id="activity-log" title="The activity log">
        <Prose>
          <p>
            We keep a log of how the Website is used, so that we can tell how
            many people use it, which parts they use, and what to improve. It is
            a table in our own database, written by our own server. There is no
            analytics product behind it, no script from anyone else’s domain,
            and no cookie beyond the ones our{' '}
            <Link href={routes.cookies}>cookie policy</Link> already lists.
          </p>

          <LegalHeading>What it records</LegalHeading>
          <ul>
            <li>
              <strong>The actions you take.</strong> Signing up, confirming your
              address, signing in and how — with a password, Google or Discord —
              having an anonymous browser’s lists added to your account, and
              resetting a password. Creating, editing, renaming, duplicating and
              deleting a list, and making a share link. Adding, changing and
              removing an entry or a photo in your collection, and changing your
              preferences. It records what kind of action it was and when, never
              the contents of a list, an entry or a photo. The builder saves a
              list as you change it, so an edit is recorded at most once every
              few minutes for each list, not once per change.
            </li>
            <li>
              <strong>The pages you open</strong>, as the kind of page — “an
              army page”, <code>/armies/[id]</code> — and never the full address
              or anything in it after a <code>?</code>.
            </li>
            <li>
              <strong>The filters you use</strong> on the army index: which
              filter, and which of its values you picked.
            </li>
          </ul>
          <p>With every one of those we record:</p>
          <ul>
            <li>
              <strong>Your account or anonymous record</strong>, if you already
              have one, and whether it is anonymous. Opening a page or using a
              filter never creates one.
            </li>
            <li>
              <strong>Your IP address.</strong>
            </li>
            <li>
              <strong>The approximate location it resolves to</strong> — a
              country, a region and a city. We look it up on our own server,
              from a copy of the DB-IP database that ships with the app, so your
              address is never sent to anyone to look up. It is as rough as any
              IP location: often the city of your internet provider, not yours.
            </li>
          </ul>
          <p>
            If your browser sends a <strong>Global Privacy Control</strong> or{' '}
            <strong>Do Not Track</strong> signal, the pages you open and the
            filters you use are not recorded at all. The actions you take are
            recorded either way.
          </p>

          <LegalHeading>Who sees it</LegalHeading>
          <p>
            The log never leaves our server, and nobody outside the operator
            sees it. We read it only in aggregate, on an admin dashboard:
            totals, counts over time, the most used pages and filters, and where
            in the world visits come from, each split between accounts and
            anonymous visitors. The dashboard cannot show one person’s activity,
            and it shows no email address and no IP address.
          </p>

          <LegalHeading>Why, and for how long</LegalHeading>
          <p>
            We keep it on our <strong>legitimate interest</strong> in running
            and improving the Service: knowing whether anyone uses a feature is
            how we decide what to fix and what to build next, and a record of
            addresses is how abuse is traced. We keep the full IP address rather
            than a shortened one for those two reasons. The log is kept{' '}
            <strong>until further notice</strong> — we have not set an expiry,
            because the point is to compare one year with the next — and if we
            ever set one, this section will say so. You can object to it, or ask
            for what it holds about your account to be deleted, as described
            under <a href="#your-rights">your rights</a>.
          </p>
          <p className="text-muted-foreground">
            <a href={externalLinks.dbIp} target="_blank" rel="noreferrer">
              IP Geolocation by DB-IP
            </a>
            , used under the{' '}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              Creative Commons Attribution 4.0 International License
            </a>
            .
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="What we do not collect">
        <Prose>
          <p>
            This list is short and specific, and worth stating plainly because
            people reasonably assume otherwise of any website:
          </p>
          <ul>
            <li>
              <strong>No analytics product.</strong> No Google Analytics, no
              Plausible, no Matomo, no session recording, no heatmaps. The
              activity log above is the whole of what we know about how the
              Website is used, and it is ours alone.
            </li>
            <li>
              <strong>
                No third-party tracking pixels or beacons, and no
                fingerprinting.
              </strong>{' '}
              The only beacon the Website sends goes to our own server, to
              record a page view or a filter in the activity log.
            </li>
            <li>
              <strong>
                No advertising, no ad networks and no advertising identifiers.
              </strong>
            </li>
            <li>
              <strong>No third-party scripts.</strong> The Website loads no code
              from anyone else’s domain. Web fonts are downloaded at build time
              and served from our own domain, so{' '}
              <em>loading a page makes no request to a third party at all</em>.
            </li>
            <li>
              <strong>No social media widgets</strong> — no like buttons, share
              buttons or embedded feeds, each of which would otherwise report
              your visit to its provider.
            </li>
            <li>
              <strong>No payment information.</strong> The Website is free and
              there is nothing to buy, so we hold no card details and no billing
              address.
            </li>
            <li>
              <strong>No location data</strong> beyond the approximate location
              we look up from your IP address, no device sensors, no contacts.
              The only photos we hold are the ones you add to your collection.
            </li>
            <li>
              <strong>
                No personal information bought, rented or obtained from data
                brokers, social platforms or any other outside source.
              </strong>{' '}
              Everything we hold about you, you gave us yourself or asked your
              identity provider to give us.
            </li>
          </ul>
          <p>
            If this ever changes, this section changes with it, and the change
            will be visible in the revision date at the top of this page.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Children">
        <Prose>
          <p>
            The Website is not directed at children. We do not knowingly collect
            personal information from anyone under 16, and if you are under 16
            you should not create an account or save lists without the consent
            of a parent or guardian. If you believe a child under 16 has given
            us personal information, contact us and we will delete it.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="How we use what we collect">
        <Prose>
          <p>
            Every use of your personal information falls under one of these:
          </p>
          <ul>
            <li>To create your account and let you sign in and out.</li>
            <li>
              To store your army lists and give them back to you on your next
              visit or another device.
            </li>
            <li>
              To send you the link that confirms your email address, and a
              password reset link when you ask for one.
            </li>
            <li>
              To keep the Service working and secure: rate-limiting sign-in,
              confirmation and reset requests, identifying and blocking abuse,
              and diagnosing errors.
            </li>
            <li>
              To understand, in aggregate, how the Service is used and what to
              improve, through the activity log.
            </li>
            <li>To answer you if you contact us for support.</li>
            <li>To comply with a legal obligation, if one ever arises.</li>
          </ul>
          <p>
            We do not profile you, we do not make automated decisions with legal
            or similarly significant effects about you, and we do not use your
            information to market anything — to you or to anyone else.
          </p>

          <LegalHeading>Legal bases under the GDPR</LegalHeading>
          <ul>
            <li>
              <strong>Performance of a contract</strong> — creating and running
              your account and storing the lists you asked us to store. Without
              this information there is no account and no saved list.
            </li>
            <li>
              <strong>Legitimate interests</strong> — keeping the Service
              available and free of abuse, and keeping the minimum session
              records needed to do that; and running and improving the Service,
              which is what the activity log is for. We have considered your
              rights, and we read the log only in aggregate and never let it
              leave our server.
            </li>
            <li>
              <strong>Consent</strong> — where you have given it, and you may
              withdraw it at any time.
            </li>
            <li>
              <strong>Legal obligation</strong> — where the law requires us to
              keep or disclose something.
            </li>
          </ul>
        </Prose>
      </LegalSection>

      <LegalSection title="Who else sees it">
        <Prose>
          <p>
            We do not sell your personal information, we do not rent or trade
            it, and we do not share it for anyone else’s marketing. The complete
            list of third parties that ever touch it is:
          </p>
        </Prose>
        <LegalTable
          columns="sm:grid sm:grid-cols-[9rem_11rem_minmax(0,1fr)]"
          headings={['Who', 'What they see', 'Why, and when']}
          rows={recipients.map(({ key, who, sees, why }) => ({
            key,
            cells: [who, sees, why],
          }))}
        />
        <Prose>
          <p>
            That is the entire list. There is no analytics provider, no
            advertising partner, no CRM, no customer data platform and no
            affiliate.
          </p>

          <LegalHeading>A list you share is public</LegalHeading>
          <p>
            Sharing is never automatic: a short link exists only because you
            pressed <strong>Share link</strong>. From then on, anyone holding
            that link can read the list behind it — and a link pasted into a
            chat window is held by everyone who can read that window. The page
            shows the army list and nothing about you: not your name, not your
            email address, not the account it came from. What it shows is a copy
            taken when you pressed the button, so editing the list afterwards
            does not change what the link shows, and a link cannot be withdrawn
            once it is out.
          </p>
          <p>
            What a link does not do is last forever unattended. Every time
            somebody opens one we note the day, and a link nobody has opened for{' '}
            <strong>24 months</strong> is deleted along with the copy behind it.
            A link that is still being passed around never expires, however old
            it is; one that went into a dead chat window eventually goes away.
            Deleting your account does not take your shared copies with it —
            they carry nothing about you, and somebody else may still be holding
            the link — so tell us if you want those removed too.
          </p>
          <p>
            We may disclose personal information where the law requires it — to
            comply with a court order or similar legal process, or where we
            believe in good faith that disclosure is necessary to protect our
            rights, investigate fraud or respond to a lawful government request.
            If the Website is ever transferred to someone else, your account and
            lists would move with it, and we would say so on the Website before
            it happened.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Where it is stored, and transfers">
        <Prose>
          <p>
            Your personal information is held in a single database file on a
            volume attached to a server we run and operate ourselves in the
            European Union. Backups are snapshots of that volume, kept in the
            same place. The database is not hosted with a third-party database
            provider and is not replicated anywhere else.
          </p>
          <p>
            Requests reach that server through Cloudflare’s global network,
            which means request metadata may be processed at a Cloudflare
            location outside the European Economic Area. That processing is
            covered by Cloudflare’s data processing terms and the European
            Commission’s Standard Contractual Clauses. If you sign in with
            Google or Discord, or receive an email through Resend, information
            travels to those providers under their own terms and safeguards.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <LegalTable
          columns="sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"
          headings={['What', 'How long']}
          rows={retention.map(({ key, what, period }) => ({
            key,
            cells: [what, period],
          }))}
        />
        <Prose>
          <p>
            We do not keep an archive of deleted accounts. The activity log
            outlives the lists it describes — a deleted list is still counted as
            having been created — and that is the only record that does.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection id="your-rights" title="Your rights">
        <Prose>
          <p>
            If you are in the European Economic Area or the United Kingdom, the
            GDPR gives you the rights below. We extend them to everyone who uses
            the Website, because operating two standards for a hobby project
            would be a poor use of everyone’s time.
          </p>
          <ul>
            <li>
              <strong>Access</strong> — to be told whether we hold personal
              information about you and to receive a copy of it.
            </li>
            <li>
              <strong>Rectification</strong> — to have inaccurate information
              corrected and incomplete information completed.
            </li>
            <li>
              <strong>Erasure</strong> — to have your personal information
              deleted.
            </li>
            <li>
              <strong>Portability</strong> — to receive the information you gave
              us in a structured, commonly used, machine-readable format.
            </li>
            <li>
              <strong>Restriction</strong> — to have processing limited in the
              circumstances the GDPR sets out.
            </li>
            <li>
              <strong>Objection</strong> — to object to processing carried out
              on the basis of our legitimate interests, on grounds relating to
              your situation.
            </li>
            <li>
              <strong>Withdrawal of consent</strong> — at any time, where
              processing rests on consent. This does not affect processing
              carried out before you withdrew it.
            </li>
            <li>
              <strong>Complaint</strong> — to lodge a complaint with your local
              supervisory authority. In Romania this is the National Supervisory
              Authority for Personal Data Processing (ANSPDCP). We would rather
              you raised it with us first, but it is your right either way.
            </li>
          </ul>

          <LegalHeading>How to exercise them</LegalHeading>
          <p>
            The <Link href={routes.account}>Account page</Link> lets you see and
            change the ways you can sign in — connecting or disconnecting Google
            and Discord — without asking us. For everything else, email us at{' '}
            <strong>{supportEmail}</strong> from the address on your account.
            There is no self-service account deletion or account export screen,
            so those are handled by hand, and we would rather say so than imply
            a button exists. We will confirm receipt and respond within one
            month, as the GDPR requires; if a request is complex we may extend
            that and will tell you why.
          </p>
          <p>
            We may need to verify that the request comes from you before we act
            on it, particularly for erasure. An anonymous record has no identity
            attached to it, so we cannot verify a request about one or match it
            to you; the way to remove those lists is to delete them in the app
            from the browser that holds them, or to leave them to the 24-month
            sweep described above.
          </p>
          <p>
            <strong>Deletion</strong> removes your account record, your sign-in
            credentials and provider links, your sessions, the army lists held
            against your account and the activity log’s record of it. Copies
            behind short links you shared are separate, and go only if you ask
            for those too. It cannot reach into backups that have already been
            taken; those rows disappear as the snapshots age out.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Cookies">
        <Prose>
          <p>
            The Website sets only cookies that are strictly necessary for it to
            work — keeping you signed in, holding a saved list against your
            browser, and securing the sign-in exchange with Google or Discord.
            There are no analytics or advertising cookies, which is why you are
            not asked to accept anything. The one other thing stored in your
            browser is your light or dark theme preference, which is kept in
            local storage and never sent to us. Our{' '}
            <Link href={routes.cookies}>cookie policy</Link> describes each
            cookie individually.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Do Not Track">
        <Prose>
          <p>
            Some browsers send a Do Not Track or Global Privacy Control signal.
            The Website does not track you across other websites under any
            circumstances, with or without one. What it does turn off is the
            part of the <a href="#activity-log">activity log</a> that records
            the pages you open and the filters you use.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Links to other websites">
        <Prose>
          <p>
            The Website links to resources we do not control, including the{' '}
            <a href={externalLinks.triumph} target="_blank" rel="noreferrer">
              Washington Grand Company
            </a>
            ’s site, the{' '}
            <a href={externalLinks.meshwesh} target="_blank" rel="noreferrer">
              Meshwesh
            </a>{' '}
            army list data project and our{' '}
            <a href={externalLinks.repository} target="_blank" rel="noreferrer">
              source code repository
            </a>
            . We are not responsible for their privacy practices, and we
            encourage you to read their policies when you follow a link.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Security">
        <Prose>
          <p>
            Traffic to the Website is encrypted in transit. Passwords are stored
            only as one-way hashes. Sign-in, confirmation and password reset
            endpoints are rate-limited. Sessions are held in cookies that
            JavaScript cannot read, marked secure and same-site. Access to the
            server is restricted to the operator.
          </p>
          <p>
            No service can promise perfect security, and this one is run by one
            person on self-hosted hardware rather than by a company with a
            security team. We think that is the right trade for an army list
            builder, and we would rather you knew it than assumed otherwise.
            Please use a unique password and keep the device you sign in from
            secure.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Data breach">
        <Prose>
          <p>
            If we become aware that personal information has been exposed, we
            will investigate, take reasonable steps to contain it, and — where
            there is a risk to your rights and freedoms — notify the relevant
            supervisory authority within 72 hours and tell affected users
            directly and by a notice on the Website.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Changes to this Policy">
        <Prose>
          <p>
            We may update this Policy. When we do, we will revise the date at
            the top of this page, and the updated version takes effect when it
            is posted. If a change is material — if we start collecting
            something new, or share information with someone not named above —
            we will not apply it to information already collected without
            telling you first. Continuing to use the Website after a change
            means you accept the revised Policy.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Contact">
        <Prose>
          <p>
            Questions, requests or complaints about this Policy or about your
            personal information: <strong>{supportEmail}</strong>
          </p>
          <p>
            {operator}, operator of triumph.saltares.dev. We will make every
            reasonable effort to resolve complaints and to honour your rights as
            quickly as possible, and in any event within the timescales set by
            applicable data protection law.
          </p>
        </Prose>
      </LegalSection>
    </LegalDocument>
  );
}
