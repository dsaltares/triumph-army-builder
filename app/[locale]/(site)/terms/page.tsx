import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Callout,
  LegalDocument,
  LegalSection,
  Prose,
  supportEmail,
} from '@/components/legal/legal-document';
import { externalLinks, routes } from '@/lib/navigation';

export const metadata: Metadata = {
  title: 'Terms and conditions',
  description:
    'The terms of using Triumph! Army Builder: an unofficial fan project, with advisory validation and no warranty.',
};

const operator = 'Saltares Marquez David Persoana Fizica Autorizata';

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms and conditions"
      summary="The terms you accept by using this app, including what its validation does and does not promise."
    >
      <Prose>
        <p>
          These terms and conditions (“Agreement”) govern your use of the{' '}
          <strong>Triumph! Army Builder</strong> website at{' '}
          <strong>triumph.saltares.dev</strong> (“Website”, “Service” or
          “Services”), operated by <strong>{operator}</strong> (“we”, “us” or
          “our”). By accessing and using the Website you acknowledge that you
          have read, understood and agree to be bound by this Agreement. If you
          do not agree, do not use the Website.
        </p>
      </Prose>

      <LegalSection title="An unofficial fan project">
        <Callout>
          <p>
            <strong>This is not an official product.</strong> <em>TRIUMPH!</em>{' '}
            is a historical miniature wargame written and published by the{' '}
            <strong>Washington Grand Company</strong>. The Website is an
            independent, unpaid fan project. It is not published, licensed,
            sponsored, endorsed by or affiliated with the Washington Grand
            Company, and nothing on it should be read as coming from them.
          </p>
        </Callout>
        <Prose>
          <p>
            <em>TRIUMPH!</em> and any associated names, logos and marks belong
            to their respective owners, and are used here only to identify the
            game the Website builds lists for. The rulebook is theirs and is not
            distributed here: the Website is a tool for people who own the game,
            not a substitute for buying it. If the{' '}
            <a href={externalLinks.triumph} target="_blank" rel="noreferrer">
              Washington Grand Company
            </a>{' '}
            ask us to change or withdraw anything, we will.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Where the army list data comes from">
        <Prose>
          <p>
            The army lists, categories, troop types, battle cards and points
            values shown on the Website are taken from{' '}
            <a href={externalLinks.meshwesh} target="_blank" rel="noreferrer">
              Meshwesh
            </a>
            , the army list data service published by the Washington Grand
            Company and served publicly and without a paywall. We redistribute a
            snapshot of that public data, with attribution, and every army list
            records the version of the data it was built against.
          </p>
          <p>
            We publish{' '}
            <strong>no material taken from the rulebook itself</strong>. Content
            that appears only in the book — tactical movement distances, base
            depths, figures per stand — is absent from the Website by deliberate
            choice, and stays absent unless and until the publisher tells us
            otherwise. Where this makes a list you export less complete than you
            expected, that is why.
          </p>
          <p>
            The underlying game data is not ours, we make no claim of ownership
            over it, and we cannot grant you rights to it. The Website’s own{' '}
            <a href={externalLinks.repository} target="_blank" rel="noreferrer">
              source code
            </a>{' '}
            is published separately under its own licence.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Validation is advisory, not authoritative">
        <Callout>
          <p>
            <strong>
              The Website’s opinion about whether a list is legal is an opinion,
              not a ruling.
            </strong>{' '}
            It is not the rulebook, it is not a tournament official, and it does
            not settle anything.
          </p>
        </Callout>
        <Prose>
          <p>
            The Website checks the list you are building against its own reading
            of the game’s construction rules and shows you what it thinks is
            wrong. It is designed to <strong>warn and never to block</strong>: a
            list you can see is always a list you can save, export and share,
            whatever the validator says about it. That design is deliberate, and
            it exists precisely because the validator can be wrong.
          </p>
          <p>It can be wrong for reasons we already know about:</p>
          <ul>
            <li>
              Our encoding of the rules is our interpretation of them. The
              rulebook is the authority and we are not.
            </li>
            <li>
              The upstream data has known rough edges. Some army lists cannot be
              built to the standard points total at all within their published
              minimums and maximums, and a number of sub-faction restrictions
              exist upstream only as free text that we interpret by hand.
            </li>
            <li>
              Events, clubs and opponents apply house rules, formats and errata
              that we do not model.
            </li>
          </ul>
          <p>
            So:{' '}
            <strong>
              a green badge is not a guarantee that a list is tournament-legal,
              and a red one is not a statement that your list is wrong.
            </strong>{' '}
            Before an event, check your list against the rulebook and against
            whatever the organiser says. We accept no responsibility for a list
            rejected at a table, a game lost, a tournament placing, or an army
            bought and painted on the strength of what the Website told you. If
            you find a case where the Website disagrees with the rulebook,
            please tell us — a report is more useful to everyone than a refund
            we could not give.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Accounts">
        <Prose>
          <p>
            You can use the Website without an account. If you create one, you
            are responsible for keeping it secure and for everything done
            through it, and you should tell us promptly at the address below if
            you believe someone else has access to it.
          </p>
          <p>
            Provide an email address that is actually yours. An account created
            with a password must confirm its address by following a link we
            email before it can be signed in to, and an account created by
            signing in with Google or Discord uses the address that provider
            confirms. This is also why you can sign in with Google on an account
            you originally made with a password: the addresses match and both
            are confirmed. You can see and change the ways you can sign in on
            the <Link href={routes.account}>Account page</Link>.
          </p>
          <p>
            You should be at least 16 to create an account, or have the consent
            of a parent or guardian. We may suspend or delete an account that
            breaks this Agreement.
          </p>
          <p>
            Lists you save before creating an account are held against your
            browser rather than against you, and are claimed by the first
            account you sign in with from that browser. Clearing your browser’s
            cookies or site data loses them, and we cannot recover them, because
            nothing connects them to a person. Anonymous lists left untouched
            for 24 months are deleted. Our{' '}
            <Link href={routes.privacy}>privacy policy</Link> explains this in
            full.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Your army lists">
        <Prose>
          <p>
            The army lists you build are yours. We do not claim ownership of
            them, we do not publish them, and we do not use them for anything
            other than storing them and giving them back to you. The only
            permission you give us is the one needed to run the Service: to
            store, copy, back up and display your lists to you, and to whoever
            you choose to share a link with.
          </p>
          <p>
            You are responsible for what you put in a list, including the names
            you give it. We may remove content that is unlawful or abusive,
            though we are under no obligation to monitor for it.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <Prose>
          <p>Do not use the Website to:</p>
          <ul>
            <li>break the law, or infringe anyone’s rights;</li>
            <li>
              gain unauthorised access to accounts, data or infrastructure, or
              probe, scan or test our systems without permission;
            </li>
            <li>
              place automated load on the Website — scraping, bulk account
              creation, bulk writes — or otherwise degrade it for other players;
            </li>
            <li>
              upload malware, or use a list name or account name to harass or
              abuse anyone;
            </li>
            <li>
              redistribute the underlying game data in ways its publisher does
              not permit, or present the Website as an official product.
            </li>
          </ul>
        </Prose>
      </LegalSection>

      <LegalSection title="A hobby service, with no guarantees">
        <Callout>
          <p>
            <strong>
              The Website is provided free of charge, as is and as available,
              with no warranty of any kind.
            </strong>{' '}
            It is run by one person on self-hosted hardware in their spare time.
          </p>
        </Callout>
        <Prose>
          <ul>
            <li>
              <strong>No uptime guarantee.</strong> Availability is whatever the
              hardware and the domestic internet connection behind it happen to
              give you. There is no service level agreement, no support
              commitment and no on-call rotation, and the Website may be down
              when you want it, including at an event.
            </li>
            <li>
              <strong>
                Backups are snapshots of a disk, and nothing better.
              </strong>{' '}
              There is no point-in-time recovery. If something goes wrong, the
              most recent snapshot is the best case and losing whatever came
              after it is the likely one.
            </li>
            <li>
              <strong>Data may be lost, and the Service may stop.</strong> We
              may change, suspend or discontinue the Website, or any part of it,
              at any time, and accounts and saved lists may go with it. We will
              make a reasonable effort to give notice on the Website, and we
              cannot promise it.
            </li>
            <li>
              <strong>Keep your own copy of anything that matters.</strong>{' '}
              Export a list you are taking to an event. Treat the Website as a
              convenience, not as the only place your army exists.
            </li>
          </ul>
          <p>
            To the fullest extent permitted by law we disclaim all warranties,
            express or implied, including merchantability, fitness for a
            particular purpose, accuracy and non-infringement.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Termination">
        <Prose>
          <p>
            You may stop using the Website at any time and ask us to delete your
            account by writing to the address below. We may suspend or terminate
            your access if you break this Agreement, if your use threatens the
            Website’s operation or other users, or if we discontinue the
            Service. On termination your right to use the Website ends; the
            sections of this Agreement that by their nature should survive, do.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Links to other resources">
        <Prose>
          <p>
            The Website links to sites we do not control. We are not responsible
            for their content, products or practices, and a link is not an
            endorsement. Review their own terms before relying on them.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <Prose>
          <p>
            To the fullest extent permitted by applicable law, in no event will{' '}
            {operator} be liable for any indirect, incidental, special, punitive
            or consequential damages, or for any loss of data, lost army lists,
            loss of use, lost time, lost games or tournament outcomes, however
            caused and under any theory of liability, even if advised of the
            possibility of such damages.
          </p>
          <p>
            To the maximum extent permitted by law, our total aggregate
            liability arising out of or relating to the Website is limited to{' '}
            <strong>fifty euros (€50)</strong>, or the amount you have actually
            paid us for the Service, whichever is greater. You have paid us
            nothing, because the Website is free.
          </p>
          <p>
            Nothing in this Agreement excludes or limits liability that cannot
            lawfully be excluded or limited, including liability for death or
            personal injury caused by negligence, for fraud, or any statutory
            rights you have as a consumer that cannot be waived.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Governing law">
        <Prose>
          <p>
            This Agreement is governed by the laws of Romania, without regard to
            conflict of law rules. If you are a consumer resident in the
            European Union, you keep the protection of the mandatory provisions
            of the law of the country you live in, and you may bring proceedings
            in your local courts.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Changes to this Agreement">
        <Prose>
          <p>
            We may modify this Agreement at any time. When we do, we will revise
            the date at the top of this page, and the updated version takes
            effect when it is posted. Continuing to use the Website after that
            means you accept the revised Agreement.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Severability and entire agreement">
        <Prose>
          <p>
            If any provision of this Agreement is found unenforceable, the rest
            remains in effect. This Agreement, together with our{' '}
            <Link href={routes.privacy}>privacy policy</Link> and{' '}
            <Link href={routes.cookies}>cookie policy</Link>, is the entire
            agreement between you and us regarding the Website. Our failure to
            enforce a provision is not a waiver of it.
          </p>
        </Prose>
      </LegalSection>

      <LegalSection title="Contact">
        <Prose>
          <p>
            Questions or complaints about this Agreement:{' '}
            <strong>{supportEmail}</strong>
          </p>
          <p>{operator}, operator of triumph.saltares.dev.</p>
        </Prose>
      </LegalSection>
    </LegalDocument>
  );
}
