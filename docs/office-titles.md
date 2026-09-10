# California official titles: admin vocabulary and representation

Reviewed September 10, 2026. This memo draws on 12 primary agency sources. It proposes a practical starter dropdown, with **Custom title** available throughout; it does not claim to enumerate every California public office.

**Keep the title, seat, and selection method separate.** Store the agency's exact primary title as a string, allow additional verified titles on the same person, and keep district/at-large assignment independent. A leadership change must not change which district a person represents.

| Agency type | Starter member titles | Leadership/officer vocabulary and official examples |
| --- | --- | --- |
| Cities | Councilmember; Council Member | Mayor, Vice Mayor ([Galt](https://www.cityofgalt.org/government/city-council-62)); Deputy Mayor ([San Mateo](https://www.cityofsanmateo.org/166/Meet-Your-Council)); Mayor Pro Tem ([Diamond Bar](https://www.diamondbarca.gov/262/City-Council)). |
| Counties | Supervisor; County Supervisor | Chair and Vice Chair ([Butte](https://www.buttecounty.net/324/Board-of-Supervisors)); Board President and Board Vice President ([Santa Clara](https://bos.santaclaracounty.gov/home)). |
| School districts and county boards of education | Board Member; Board of Education Member; Trustee | Board President and Board Vice President ([Napa COE](https://napacoe.org/board-of-education/)); President, Vice President and Clerk ([Manteca Unified](https://www.mantecausd.net/our-district/board-and-superintendent)); combined Vice President/Clerk ([Paramount Unified](https://www.paramountusd.com/board/board-of-education)). |
| Community colleges | Trustee; Board Member | President and Vice President, displayed alongside the trustee's area ([Los Rios](https://losrios.edu/about-los-rios/board-of-trustees/our-trustees)). |
| Special districts and related joint boards | Director; Board Director; Commissioner; Harbor Commissioner; Trustee where the agency uses it | President, Vice President, Secretary/Board Secretary and Treasurer ([San Mateo County Harbor District](https://www.smharbor.com/harbor-district-board-of-commissioners)); Chair, Vice Chair and combined Secretary/Treasurer ([Solano GSA](https://scwa2.com/governance/solano-gsa-board-of-directors/)). Butte's supervisors also sit as cemetery-district trustees ([Butte](https://www.buttecounty.net/324/Board-of-Supervisors)). |

The table groups terminology into useful presets. Expanded labels such as Board Director and Board of Education Member, plus Chairperson/Chairman variants, are proposed editable display forms; they should not overwrite an agency's verified wording or be treated as different legal offices. These presets are suggestions, not restrictions by agency type.

## Why a title cannot determine representation

Belmont has four district councilmembers and a separate mayor elected citywide, with four-year council terms and a two-year mayoral term. San Mateo's roster instead explicitly places its Mayor in District 5 and Deputy Mayor in District 2. The word Mayor therefore cannot be used to infer an at-large seat. [Belmont handbook](https://www.belmont.gov/home/showdocument?id=20487&t=638591622715204128), [San Mateo roster](https://www.cityofsanmateo.org/166/Meet-Your-Council)

Diamond Bar's district councilmembers serve four-year terms while their Mayor and Mayor Pro Tem assignments last one year. Butte likewise separates four-year supervisor terms from annually selected board leadership. Store seat-term and leadership-term dates independently when those dates are available. [Diamond Bar](https://www.diamondbarca.gov/262/City-Council), [Butte](https://www.buttecounty.net/324/Board-of-Supervisors)

Paramount expressly combines Vice President and Clerk in one officer assignment. Los Rios displays its President and Vice President with their trustee areas. Permit multiple titles on one person without adding duplicate people or district seats. Preserve combined display wording if that is the agency's preference. [Paramount](https://www.paramountusd.com/board/board-of-education), [Los Rios](https://losrios.edu/about-los-rios/board-of-trustees/our-trustees)

Solano GSA lists a county Supervisor as its Chair and a city Mayor as its Vice Chair. Those are roles on different governing bodies; each body needs its own membership relationship. A title from another body is not proof of a directly elected GSA seat. [Solano GSA](https://scwa2.com/governance/solano-gsa-board-of-directors/)

## Staff, student members and custom offices

Manteca's superintendent acts as board secretary, while its Clerk is a trustee. Napa COE separately lists a Board Secretary contact and student members. A Secretary or Clerk label alone cannot establish that someone occupies an elected district seat. Verify membership before presenting staff as an elected representative. [Manteca](https://www.mantecausd.net/our-district/board-and-superintendent), [Napa COE](https://napacoe.org/board-of-education/)

Los Rios identifies its Student Trustee as elected by students and non-voting. Student constituency and voting status require separate fields if the product expands to these memberships; do not infer that all student trustees have identical rights or make them an ordinary at-large voter seat. [Los Rios](https://losrios.edu/about-los-rios/board-of-trustees/our-trustees)

Napa COE's Board Trustee Representative illustrates why Custom should remain available. Preserve source spelling and combined labels. A vacancy is a seat status, an appointment is how a seat was filled, and a first district election is a timeline event; none is a replacement for the person's office title. [Napa COE](https://napacoe.org/board-of-education/)

## Implementation boundaries

The accompanying JSON distinguishes observed source facts from proposed presets. The current controls retain `Official.title: string`, optional `additionalTitles: string[]`, `district: string | null`, and optional `selectionMethod: elected | appointed`. Missing selection method stays unknown. Each mapped district has explicit active/transition status and an optional first-election month. Changing that date never silently activates a seat. Existing nonstandard titles open in Custom without modification.

This simple geographic model does not yet represent every possible multimember district, student/ex-officio membership, or appointed joint-board constituency. Keep those cases out of automatic imports until their membership rules are modeled. The separate Galt transition memo contains the detailed evidence for continuing at-large service during a district-election transition.

## Source limitations

Belmont's handbook text was available through the official-page search index, while direct city retrieval returned HTTP 403. Other cited HTML pages were opened successfully through the web tool. San Mateo County Harbor District's overview simultaneously labels separate profiles Secretary and Board Secretary; this memo uses it as title-vocabulary evidence, not as confirmation of two distinct current secretary offices. Verify officer assignments with current agency records before changing a roster.
